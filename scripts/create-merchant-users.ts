import { randomBytes, scryptSync } from "node:crypto";
import { Client } from "pg";

const PASSWORD_LENGTH = 12;
const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const EMAIL_DOMAIN = "merchant.local";

const toBase62 = (input: Buffer) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = BigInt("0x" + input.toString("hex"));
  if (value === 0n) return alphabet[0];
  let out = "";
  while (value > 0n) {
    const idx = Number(value % 62n);
    out = alphabet[idx] + out;
    value = value / 62n;
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

const ensureUnique = async (client: Client, base: string, checkSql: string) => {
  let candidate = base;
  let suffix = 1;
  while (true) {
    const { rows } = await client.query(checkSql, [candidate]);
    if (rows.length === 0) return candidate;
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }
};

const run = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows: targets } = await client.query<{
      canonical_merchant_key: string;
      uniq_merchant: string;
    }>(`
      with canon as (
        select distinct canonical_merchant_key
        from merchant_canonical_map
      )
      select c.canonical_merchant_key, dm.uniq_merchant
      from canon c
      join dim_merchant dm on dm.merchant_key = c.canonical_merchant_key
      left join merchant_users mu on mu.merchant_key = c.canonical_merchant_key and mu.is_active = true
      where mu.user_id is null
        and dm.uniq_merchant is not null
        and btrim(dm.uniq_merchant) <> ''
      order by dm.uniq_merchant;
    `);

    if (targets.length === 0) {
      console.log("No missing merchants found. Nothing to create.");
      return;
    }

    console.log("email,username,password,merchant_key");

    for (const target of targets) {
      const baseUsername = slugify(target.uniq_merchant) || `merchant_${target.canonical_merchant_key.slice(0, 8)}`;
      const username = await ensureUnique(
        client,
        baseUsername,
        "select 1 from users where username = $1 limit 1"
      );

      const baseEmail = `${username}@${EMAIL_DOMAIN}`;
      const email = await ensureUnique(
        client,
        baseEmail,
        "select 1 from users where email = $1 limit 1"
      );

      const password = generatePassword();
      const passwordHash = hashPassword(password);

      const userInsert = await client.query<{ id: number }>(
        `
          insert into users (email, username, password_hash, role, is_active)
          values ($1, $2, $3, 'merchant', true)
          returning id
        `,
        [email, username, passwordHash]
      );

      const userId = userInsert.rows[0]?.id;
      if (!userId) {
        throw new Error(`Failed to create user for ${target.uniq_merchant}`);
      }

      await client.query(
        `
          insert into merchant_users (user_id, merchant_key, is_active)
          values ($1, $2::uuid, true)
          on conflict (user_id, merchant_key) do update
          set is_active = true, updated_at = now()
        `,
        [userId, target.canonical_merchant_key]
      );

      console.log(`${email},${username},${password},${target.canonical_merchant_key}`);
    }
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
