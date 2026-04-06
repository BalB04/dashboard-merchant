import { sql } from "drizzle-orm";

import { db } from "../lib/db";
import { merchantUsers, users } from "../lib/db/schema";
import { hashPassword } from "../lib/security/password";
import { requireEnv } from "./_helpers";

const email = requireEnv("MERCHANT_EMAIL").toLowerCase();
const username = requireEnv("MERCHANT_USERNAME");
const merchantKey = requireEnv("MERCHANT_KEY");
const passwordHash = process.env.MERCHANT_PASSWORD_HASH?.trim()
  || (process.env.MERCHANT_PASSWORD ? hashPassword(process.env.MERCHANT_PASSWORD) : "");

if (!passwordHash) {
  throw new Error("MERCHANT_PASSWORD or MERCHANT_PASSWORD_HASH is required");
}

const run = async () => {
  await db.transaction(async (tx) => {
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
        merchantKey,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: merchantUsers.userId,
        set: {
          merchantKey,
          isActive: true,
          updatedAt: sql`now()`,
        },
      });
  });

  console.log(`Seeded merchant user ${email} -> ${merchantKey}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
