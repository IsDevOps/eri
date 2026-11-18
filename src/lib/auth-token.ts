import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type Role = "admin" | "observer" | "witness";
export const ROLES: Role[] = ["admin", "observer", "witness"];
export const COOKIE = "eri_session";
export const SESSION_HOURS = 8;

/** Where each role lands after login, and which sections each role may open. */
export const HOME: Record<Role, string> = { admin: "/admin", observer: "/dashboard", witness: "/witness" };
export const SECTION_ROLES: Record<string, Role[]> = {
  "/dashboard": ["admin", "observer"],
  "/ear": ["admin", "observer"],
  "/phone": ["admin"],
  "/admin": ["admin"],
  "/witness": ["witness"],
};

function secret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const g = globalThis as unknown as { __eriSecret?: string };
  if (process.env.NODE_ENV !== "production") return "eri-dev-secret-not-for-production";
  // Production without AUTH_SECRET: random per process (sessions end on restart). Set AUTH_SECRET to persist them.
  return (g.__eriSecret ??= randomBytes(32).toString("hex"));
}

const mac = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export interface TokenPayload {
  uid: number;
  role: Role;
  exp: number; // epoch seconds
}

export function signToken(p: Omit<TokenPayload, "exp">): string {
  const body = Buffer.from(JSON.stringify({ ...p, exp: Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600 })).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function verifyToken(token: string | undefined | null): TokenPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = mac(body);
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    return p.exp > Date.now() / 1000 && ROLES.includes(p.role) ? p : null;
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
