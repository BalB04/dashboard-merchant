import process from "node:process";

import { eq, sql } from "drizzle-orm";

import { db } from "../src/lib/db";
import { userAccounts } from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/security/password";

function createPrompt() {
  function prompt(question: string, { mask = false }: { mask?: boolean } = {}) {
    if (!process.stdin.isTTY) {
      throw new Error("Password prompt requires an interactive terminal");
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
    askYesNo: async (question: string, defaultYes = true) => {
      const suffix = defaultYes ? " [Y/n]: " : " [y/N]: ";
      const answer = (await prompt(`${question}${suffix}`)).trim().toLowerCase();
      if (!answer) {
        return defaultYes;
      }
      return answer === "y" || answer === "yes";
    },
  };
}

const { ask, askSecret, askYesNo } = createPrompt();

async function main() {
  const envEmail = process.env.USER_EMAIL?.trim() || "";
  const envUsername = process.env.USER_USERNAME?.trim() || "";

  if (envEmail && envUsername) {
    throw new Error("Provide either USER_EMAIL or USER_USERNAME, not both");
  }

  const identifierInput =
    envEmail || envUsername || (await ask("Email or username: ")).trim();

  if (!identifierInput) {
    throw new Error("Email or username is required");
  }

  const isEmail = identifierInput.includes("@");
  const email = isEmail ? identifierInput.toLowerCase() : null;
  const username = isEmail ? null : identifierInput;

  const passwordHash = process.env.NEW_PASSWORD_HASH?.trim() || "";
  const password = passwordHash ? null : process.env.NEW_PASSWORD?.trim() || (await askSecret("New password: "));

  if (!passwordHash) {
    if (!password) {
      throw new Error("New password or NEW_PASSWORD_HASH is required");
    }
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
  }

  const finalPasswordHash = passwordHash || hashPassword(password!);

  if (!passwordHash) {
    const confirmPassword = await askSecret("Confirm new password: ");
    if (password !== confirmPassword) {
      throw new Error("Password confirmation does not match");
    }
  }

  const activateAccountEnv = process.env.SET_ACTIVE?.trim().toLowerCase();
  const setActive =
    activateAccountEnv === "true" ||
    activateAccountEnv === "1" ||
    activateAccountEnv === "yes"
      ? true
      : activateAccountEnv === "false" || activateAccountEnv === "0" || activateAccountEnv === "no"
        ? false
        : await askYesNo("Activate account?", true);

  const whereClause = email
    ? eq(userAccounts.email, email)
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
      passwordHash: finalPasswordHash,
      isActive: setActive,
      updatedAt: sql`now()`,
    })
    .where(eq(userAccounts.id, user.id));

  console.log(`Updated password for ${user.email}${setActive ? " and activated account" : ""}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    process.stdin.setRawMode?.(false);
  });
