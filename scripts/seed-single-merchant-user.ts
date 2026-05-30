import { eq, inArray, sql } from "drizzle-orm";

import { db } from "../src/lib/db";
import { dimMerchant, userAccounts } from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/security/password";
import { requireEnv } from "./_helpers";

const email = requireEnv("MERCHANT_EMAIL").toLowerCase();
const username = requireEnv("MERCHANT_USERNAME");
const merchantKeys = (process.env.MERCHANT_KEYS || requireEnv("MERCHANT_KEY"))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const passwordHash =
  process.env.MERCHANT_PASSWORD_HASH?.trim() ||
  (process.env.MERCHANT_PASSWORD ? hashPassword(process.env.MERCHANT_PASSWORD) : "");

if (!passwordHash) {
  throw new Error("MERCHANT_PASSWORD or MERCHANT_PASSWORD_HASH is required");
}

if (merchantKeys.length === 0) {
  throw new Error("MERCHANT_KEY or MERCHANT_KEYS is required");
}

const run = async () => {
  await db.transaction(async (tx) => {
    await tx
      .insert(userAccounts)
      .values({
        email,
        username,
        passwordHash,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: userAccounts.email,
        set: {
          username,
          passwordHash,
          isActive: true,
          updatedAt: sql`now()`,
        },
      });

    const user = await tx
      .select({ id: userAccounts.id })
      .from(userAccounts)
      .where(eq(userAccounts.email, email))
      .limit(1);
    const userId = user[0]?.id;

    if (!userId) {
      throw new Error(`Failed to find seeded account for ${email}`);
    }

    const validMerchants = await tx
      .select({ merchantKey: dimMerchant.merchantKey })
      .from(dimMerchant)
      .where(inArray(dimMerchant.merchantKey, merchantKeys));

    if (validMerchants.length !== new Set(merchantKeys).size) {
      throw new Error("One or more MERCHANT_KEYS do not exist in dim_merchant");
    }

    await tx
      .update(dimMerchant)
      .set({ userAccountId: userId })
      .where(inArray(dimMerchant.merchantKey, merchantKeys));
  });

  console.log(`Seeded merchant account ${email} -> ${merchantKeys.join(",")}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
