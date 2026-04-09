import { sql } from "drizzle-orm";

import { db } from "../lib/db";
import { merchantUsers, users } from "../lib/db/schema";
import { hashPassword } from "../lib/security/password";
import { requireEnv } from "./_helpers";

const email = requireEnv("MERCHANT_EMAIL").toLowerCase();
const username = requireEnv("MERCHANT_USERNAME");
const merchantKey = requireEnv("MERCHANT_KEY");
const merchantScopeType = (process.env.MERCHANT_SCOPE_TYPE?.trim().toLowerCase() || "merchant") as "merchant" | "canonical";
const passwordHash = process.env.MERCHANT_PASSWORD_HASH?.trim()
  || (process.env.MERCHANT_PASSWORD ? hashPassword(process.env.MERCHANT_PASSWORD) : "");

if (!passwordHash) {
  throw new Error("MERCHANT_PASSWORD or MERCHANT_PASSWORD_HASH is required");
}

if (merchantScopeType !== "merchant" && merchantScopeType !== "canonical") {
  throw new Error("MERCHANT_SCOPE_TYPE must be 'merchant' or 'canonical'");
}

const run = async () => {
  let resolvedMerchantKey = merchantKey;

  await db.transaction(async (tx) => {
    if (merchantScopeType === "canonical") {
      resolvedMerchantKey = (
        await tx.execute<{ canonical_merchant_key: string }>(sql`
          select canonical_merchant_key
          from merchant_canonical_map
          where merchant_key = ${merchantKey}::uuid
          limit 1
        `)
      ).rows[0]?.canonical_merchant_key || merchantKey;
    }

    await tx
      .insert(users)
      .values({
        email,
        username,
        passwordHash,
        role: "merchant",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          username,
          passwordHash,
          role: "merchant",
          isActive: true,
          updatedAt: sql`now()`,
        },
      });

    const user = await tx.select({ id: users.id }).from(users).where(sql`${users.email} = ${email}`).limit(1);
    const userId = user[0]?.id;

    if (!userId) {
      throw new Error(`Failed to find seeded user for ${email}`);
    }

    await tx
      .insert(merchantUsers)
      .values({
        userId,
        merchantKey: resolvedMerchantKey,
        scopeType: merchantScopeType,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: merchantUsers.userId,
        set: {
          merchantKey: resolvedMerchantKey,
          scopeType: merchantScopeType,
          isActive: true,
          updatedAt: sql`now()`,
        },
      });
  });

  console.log(`Seeded merchant user ${email} -> ${resolvedMerchantKey} (${merchantScopeType})`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
