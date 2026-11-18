import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE, HOME, SECTION_ROLES, verifyToken } from "@/lib/auth-token";

/**
 * Optimistic gate: send signed-out visitors to /login and wrong-role visitors to their own home.
 * The real authorization is re-checked against the database in every page layout and every API route.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const section = Object.keys(SECTION_ROLES).find((s) => pathname === s || pathname.startsWith(s + "/"));
  if (!section) return NextResponse.next();

  const tok = verifyToken(req.cookies.get(COOKIE)?.value);
  if (!tok) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (!SECTION_ROLES[section].includes(tok.role)) {
    return NextResponse.redirect(new URL(`${HOME[tok.role]}?denied=1`, req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/ear/:path*", "/phone/:path*", "/admin/:path*", "/witness/:path*"] };
