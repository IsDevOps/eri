import { createHash, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { q, q1 } from "./db";
import { COOKIE, HOME, SESSION_HOURS, safeEqual, signToken, verifyToken, type Role } from "./auth-token";
import { json } from "./http";

export { HOME, ROLES, type Role } from "./auth-token";

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  phoneVerified: boolean;
}

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  phone_verified: boolean;
  disabled: boolean;
}

const toUser = (r: UserRow): SessionUser => ({ id: r.id, email: r.email, name: r.name, role: r.role, phone: r.phone, phoneVerified: r.phone_verified });

/** The signed-in user, re-read from the DB on every call so disabling an account or changing a role takes effect at once. */
export async function getUser(): Promise<SessionUser | null> {
  const tok = verifyToken((await cookies()).get(COOKIE)?.value);
  if (!tok) return null;
  const u = await q1<UserRow>("select id, email, name, role, phone, phone_verified, disabled from app_user where id=$1", [tok.uid]);
  return u && !u.disabled ? toUser(u) : null;
}

/** While SMS delivery is simulated (no gateway keys), the verification code is returned to the client so sign-up can finish. */
export const showSmsCodes = (): boolean => process.env.SHOW_SMS_CODES === "1" || process.env.DEMO_LOGINS === "1";

export async function startSession(u: { id: number; role: Role }) {
  (await cookies()).set(COOKIE, signToken({ uid: u.id, role: u.role }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "1",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** Server components / layouts: redirect to /login, or to the user's own home if their role may not see this section. */
export async function requirePage(roles: Role[]): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/login");
  if (!roles.includes(u.role)) redirect(`${HOME[u.role]}?denied=1`);
  return u;
}

/* ---------------- route-handler guard ---------------- */

/** Browsers always send Origin on cross-site POSTs; refuse state-changing requests that come from another site. */
export function sameOrigin(req: Request): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

type Handler<C> = (req: Request, ctx: C, user: SessionUser) => Promise<Response> | Response;

/** Wrap a route handler: 401 if signed out, 403 if the role isn't allowed or the request is a cross-site write. */
export function guard<C = unknown>(roles: Role[] | "any", handler: Handler<C>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    const user = await getUser();
    if (!user) return json({ error: "authentication required" }, 401);
    if (roles !== "any" && !roles.includes(user.role)) return json({ error: "forbidden" }, 403);
    if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req)) return json({ error: "cross-site request refused" }, 403);
    return handler(req, ctx, user);
  };
}

/** Inbound SMS/USSD webhooks: provider calls carry WEBHOOK_SECRET (header `x-webhook-secret` or `?key=`); the admin simulator uses its session. */
export async function webhookAllowed(req: Request): Promise<boolean> {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const given = req.headers.get("x-webhook-secret") ?? new URL(req.url).searchParams.get("key") ?? "";
    if (safeEqual(given, secret)) return true;
  }
  const u = await getUser();
  return u?.role === "admin" && sameOrigin(req);
}

/* ---------------- rate limiting (in-memory, per process) ---------------- */

const hits = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return false;
}
export const clientIp = (req: Request) => (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();

/* ---------------- phone verification codes ---------------- */

const otpHash = (uid: number, code: string) => createHash("sha256").update(`${uid}:${code}`).digest("hex");

export async function issuePhoneCode(uid: number): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await q("update app_user set otp_hash=$2, otp_expires=now() + interval '10 minutes', otp_tries=0 where id=$1", [uid, otpHash(uid, code)]);
  return code;
}

export async function checkPhoneCode(uid: number, code: string): Promise<"ok" | "wrong" | "expired" | "locked"> {
  const r = await q1<{ otp_hash: string | null; expired: boolean; otp_tries: number }>(
    "select otp_hash, otp_expires < now() as expired, otp_tries from app_user where id=$1",
    [uid],
  );
  if (!r?.otp_hash || r.expired) return "expired";
  if (r.otp_tries >= 5) return "locked";
  if (!safeEqual(otpHash(uid, code), r.otp_hash)) {
    await q("update app_user set otp_tries = otp_tries + 1 where id=$1", [uid]);
    return "wrong";
  }
  await q("update app_user set phone_verified=true, otp_hash=null, otp_expires=null, otp_tries=0 where id=$1", [uid]);
  return "ok";
}

/* ---------------- failed-login lockout ---------------- */

const fails = new Map<string, number[]>();
const FAIL_WINDOW = 15 * 60_000;
export const isLocked = (key: string, max: number) => (fails.get(key) ?? []).filter((t) => Date.now() - t < FAIL_WINDOW).length >= max;
export const recordFail = (key: string) => fails.set(key, [...(fails.get(key) ?? []).filter((t) => Date.now() - t < FAIL_WINDOW), Date.now()]);
export const clearFails = (key: string) => fails.delete(key);
