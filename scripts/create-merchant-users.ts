import { randomBytes, scryptSync } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import { db } from "../lib/db";
import { merchantUsers, users } from "../lib/db/schema";

const PASSWORD_LENGTH = 12;
const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const EMAIL_DOMAIN = "merchant.local";

const toBase62 = (input: Buffer) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = BigInt("0x" + input.toString("hex"));
  const zero = BigInt(0);
  const base = BigInt(62);
  if (value === zero) return alphabet[0];
  let out = "";
  while (value > zero) {
    const idx = Number(value % base);
    out = alphabet[idx] + out;
    value /= base;
  }
  return out;
};

const generatePassword = () => toBase62(randomBytes(16)).slice(0, PASSWORD_LENGTH);

const hashPassword = (password: string) => {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

const ensureUnique = async (base: string, column: "username" | "email") => {
  let candidate = base;
  let suffix = 1;
  const targetColumn = column === "username" ? users.username : users.email;

  while (true) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(targetColumn, candidate))
      .limit(1);

    if (existing.length === 0) {
      return candidate;
    }

    suffix += 1;
    candidate = `${base}_${suffix}`;
  }
};

const run = async () => {
  const targets = await db.execute<{
    canonical_merchant_key: string;
    uniq_merchant: string;
  }>(sql`
    with canon as (
      select distinct canonical_merchant_key
      from merchant_canonical_map
    )
    select c.canonical_merchant_key, dm.uniq_merchant
    from canon c
    join dim_merchant dm on dm.merchant_key = c.canonical_merchant_key
    left join merchant_users mu
      on mu.merchant_key = c.canonical_merchant_key
      and mu.is_active = true
    where mu.user_id is null
      and dm.uniq_merchant is not null
      and btrim(dm.uniq_merchant) <> ''
    order by dm.uniq_merchant
  `);

  if (targets.rows.length === 0) {
    console.log("No missing merchants found. Nothing to create.");
    return;
  }

  console.log("email,username,password,merchant_key");

  for (const target of targets.rows) {
    const baseUsername =
      slugify(target.uniq_merchant) || `merchant_${target.canonical_merchant_key.slice(0, 8)}`;
    const username = await ensureUnique(baseUsername, "username");

    const baseEmail = `${username}@${EMAIL_DOMAIN}`;
    const email = await ensureUnique(baseEmail, "email");

    const password = generatePassword();
    const passwordHash = hashPassword(password);

    const userInsert = await db
      .insert(users)
      .values({
        email,
        username,
        passwordHash,
        role: "merchant",
        isActive: true,
      })
      .returning({ id: users.id });

    const userId = userInsert[0]?.id;
    if (!userId) {
      throw new Error(`Failed to create user for ${target.uniq_merchant}`);
    }

    await db
      .insert(merchantUsers)
      .values({
        userId,
        merchantKey: target.canonical_merchant_key,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: merchantUsers.userId,
        set: {
          merchantKey: target.canonical_merchant_key,
          isActive: true,
          updatedAt: sql`now()`,
        },
      });

    console.log(`${email},${username},${password},${target.canonical_merchant_key}`);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
