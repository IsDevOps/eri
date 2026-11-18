import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** scrypt$<salt b64>$<hash b64> — memory-hard, per-user random salt. */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${h.toString("base64")}`;
}

// A real hash of a random string, so unknown emails cost the same time as wrong passwords.
const DUMMY = hashPassword(randomBytes(12).toString("hex"));

export async function verifyPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  const [alg, saltB64, hashB64] = (stored ?? (await DUMMY)).split("$");
  if (alg !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const got = await scrypt(pw, Buffer.from(saltB64, "base64"), expected.length);
  return stored != null && got.length === expected.length && timingSafeEqual(got, expected);
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (pw.length > 200) return "Password is too long.";
  return null;
}
