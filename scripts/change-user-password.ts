import { eq, sql } from "drizzle-orm";

import { db } from "../src/lib/db";
import { userAccounts } from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/security/password";

const email = process.env.USER_EMAIL?.trim();
const username = process.env.USER_USERNAME?.trim();

if (email && username) {
  throw new Error("Provide either USER_EMAIL or USER_USERNAME, not both");
}

if (!email && !username) {
  throw new Error("USER_EMAIL or USER_USERNAME is required");
}

const passwordHash =
  process.env.NEW_PASSWORD_HASH?.trim() ||
  (process.env.NEW_PASSWORD ? hashPassword(process.env.NEW_PASSWORD) : "");

if (!passwordHash) {
  throw new Error("NEW_PASSWORD or NEW_PASSWORD_HASH is required");
}

const run = async () => {
  const whereClause = email
    ? eq(userAccounts.email, email.toLowerCase())
    : eq(userAccounts.username, username!);

  const matches = await db
    .select({
      id: userAccounts.id,
      email: userAccounts.email,
      username: userAccounts.username,
    })
    .from(userAccounts)
    .where(whereClause)
    .limit(2);

  if (matches.length === 0) {
    throw new Error("No user found for the provided identifier");
  }

  if (matches.length > 1) {
    throw new Error("More than one user matched the provided identifier");
  }

  const user = matches[0];
  console.log(`Matched ${user.email}${user.username ? ` (${user.username})` : ""}`);

  await db
    .update(userAccounts)
    .set({
      passwordHash,
      updatedAt: sql`now()`,
    })
    .where(eq(userAccounts.id, user.id));

  console.log(`Updated password for ${user.email}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
