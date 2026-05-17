import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
};

export const verifyPassword = (password: string, hashedPassword: string) => {
  const [salt, storedHash] = hashedPassword.split(":");
  if (!salt || !storedHash) {
    return false;
  }

  const candidateHash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  const storedBuffer = Buffer.from(storedHash, "hex");
  const candidateBuffer = Buffer.from(candidateHash, "hex");

  if (storedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, candidateBuffer);
};
