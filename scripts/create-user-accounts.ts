import { randomBytes, scryptSync } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";

import { db } from "../src/lib/db";
import { dimMerchant, userAccounts } from "../src/lib/db/schema";

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
  const targetColumn = column === "username" ? userAccounts.username : userAccounts.email;

  while (true) {
    const existing = await db
      .select({ id: userAccounts.id })
      .from(userAccounts)
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
    uniq_merchant: string;
    merchant_keys: string[];
  }>(sql`
    select
      dm.uniq_merchant,
      array_agg(dm.merchant_key order by dm.merchant_name, dm.keyword_code) as merchant_keys
    from dim_merchant dm
    where dm.user_account_id is null
      and dm.uniq_merchant is not null
      and btrim(dm.uniq_merchant) <> ''
    group by dm.uniq_merchant
    order by dm.uniq_merchant
  `);

  if (targets.rows.length === 0) {
    console.log("No unassigned merchants found. Nothing to create.");
    return;
  }

  console.log("email,username,password,merchant_count");

  for (const target of targets.rows) {
    const baseUsername = slugify(target.uniq_merchant) || `merchant_${target.merchant_keys[0].slice(0, 8)}`;
    const username = await ensureUnique(baseUsername, "username");
    const email = await ensureUnique(`${username}@${EMAIL_DOMAIN}`, "email");
    const password = generatePassword();
    const passwordHash = hashPassword(password);

    const created = await db
      .insert(userAccounts)
      .values({
        email,
        username,
        passwordHash,
        isActive: true,
      })
      .returning({ id: userAccounts.id });

    const userId = created[0]?.id;
    if (!userId) {
      throw new Error(`Failed to create account for ${target.uniq_merchant}`);
    }

    await db
      .update(dimMerchant)
      .set({ userAccountId: userId })
      .where(inArray(dimMerchant.merchantKey, target.merchant_keys));

    console.log(`${email},${username},${password},${target.merchant_keys.length}`);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
