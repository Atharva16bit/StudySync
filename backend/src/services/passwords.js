import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);
const keyLength = 64;

const options = {
  N: 32768,
  r: 8,
  p: 3,
  maxmem: 64 * 1024 * 1024,
};

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, keyLength, options);

  return `scrypt-v1$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  const match = /^scrypt-v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(storedHash);

  if (!match) return false;

  const [, saltHex, keyHex] = match;
  const salt = Buffer.from(saltHex, "hex");
  const expectedKey = Buffer.from(keyHex, "hex");
  const suppliedKey = await deriveKey(password, salt, keyLength, options);

  return timingSafeEqual(expectedKey, suppliedKey);
}
