import process from "node:process";

import { eq, inArray, sql } from "drizzle-orm";

import { db } from "../src/lib/db";
import { dimMerchant, userAccounts } from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/security/password";

function createPrompt() {
  function prompt(question: string, { mask = false }: { mask?: boolean } = {}) {
    if (!process.stdin.isTTY) {
      throw new Error("Interactive prompt requires a terminal");
    }

    return new Promise<string>((resolve) => {
      const stdin = process.stdin;
      const stdout = process.stdout;

      stdout.write(question);
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding("utf8");

      let value = "";

      function cleanup() {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdout.write("\n");
      }

      function onData(char: string) {
        const key = char.toString();

        if (key === "\r" || key === "\n") {
          cleanup();
          resolve(value);
          return;
        }

        if (key === "\u0003") {
          cleanup();
          process.exit(130);
        }

        if (key === "\u007f" || key === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
          return;
        }

        if (key === "\u001b") {
          return;
        }

        value += key;
        stdout.write(mask ? "*" : key);
      }

      stdin.on("data", onData);
    });
  }

  return {
    ask: (question: string) => prompt(question),
    askSecret: (question: string) => prompt(question, { mask: true }),
  };
}

const { ask, askSecret } = createPrompt();

const normalizeList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

async function main() {
  const envEmail = process.env.MERCHANT_EMAIL?.trim() || "";
  const envUsername = process.env.MERCHANT_USERNAME?.trim() || "";
  const envMerchantKeys = normalizeList(process.env.MERCHANT_KEYS?.trim() || "");
  const envMerchantKey = process.env.MERCHANT_KEY?.trim() || "";
  const envPasswordHash = process.env.MERCHANT_PASSWORD_HASH?.trim() || "";
  const envPassword = process.env.MERCHANT_PASSWORD?.trim() || "";

  const emailInput = envEmail || (await ask("Merchant email: ")).trim();
  if (!emailInput) {
    throw new Error("Merchant email is required");
  }

  const usernameInput = envUsername || (await ask("Merchant username: ")).trim();
  if (!usernameInput) {
    throw new Error("Merchant username is required");
  }

  const merchantKeysInput =
    envMerchantKeys.length > 0
      ? envMerchantKeys
      : envMerchantKey
        ? [envMerchantKey]
        : normalizeList((await ask("Merchant keys (comma separated, optional): ")).trim());

  let passwordHash = envPasswordHash;
  if (!passwordHash) {
    let password = envPassword;
    if (!password) {
      password = await askSecret("Merchant password: ");
      if (!password) {
        throw new Error("Merchant password is required");
      }
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const confirmPassword = await askSecret("Confirm merchant password: ");
    if (password !== confirmPassword) {
      throw new Error("Password confirmation does not match");
    }

    passwordHash = hashPassword(password);
  }

  const email = emailInput.toLowerCase();
  const username = usernameInput;
  const merchantKeys = Array.from(new Set(merchantKeysInput));

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

    if (merchantKeys.length > 0) {
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
    }
  });

  console.log(
    merchantKeys.length > 0
      ? `Seeded merchant account ${email} -> ${merchantKeys.join(",")}`
      : `Seeded merchant account ${email} without merchant assignment`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
