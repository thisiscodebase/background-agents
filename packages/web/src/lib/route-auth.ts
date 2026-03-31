import type { NextRequest } from "next/server";
import type { JWT } from "next-auth/jwt";
import { getToken } from "next-auth/jwt";

function authSecret(): string {
  const s = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!s) {
    throw new Error("NEXTAUTH_SECRET (or AUTH_SECRET) is not set");
  }
  return s;
}

/**
 * Parse the raw `Cookie` header into a name→value map (supports chunked NextAuth cookies).
 */
function cookiesFromHeader(cookieHeader: string | null): Record<string, string> {
  const jar: Record<string, string> = {};
  if (!cookieHeader) return jar;
  for (const segment of cookieHeader.split(";")) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    const rawValue = trimmed.slice(eq + 1);
    if (!name) continue;
    try {
      jar[name] = decodeURIComponent(rawValue.replace(/\+/g, " "));
    } catch {
      jar[name] = rawValue;
    }
  }
  return jar;
}

/**
 * Build a request-like object next-auth's SessionStore can read.
 *
 * In the App Router, `req.cookies` / `cookies()` is sometimes empty in Route Handlers even when
 * the browser sent a session — the `Cookie` header still has the values. NextAuth's `getToken`
 * only reads from the `cookies` object passed into SessionStore, not by re-parsing headers.
 */
function nextAuthReqFromIncoming(req: NextRequest): NextRequest {
  const fromAdapter = Object.fromEntries(req.cookies.getAll().map((c) => [c.name, c.value]));
  const fromHeader = cookiesFromHeader(req.headers.get("cookie"));
  const merged = { ...fromAdapter, ...fromHeader };
  return { headers: req.headers, cookies: merged } as unknown as NextRequest;
}

/**
 * Resolve the signed-in JWT from the incoming Route Handler request.
 */
export async function getRouteAuthToken(req: NextRequest): Promise<JWT | null> {
  const secret = authSecret();
  const reqForToken = nextAuthReqFromIncoming(req);

  const token = await getToken({ req: reqForToken, secret });
  if (token) return token;

  // Cookie name prefix depends on secure vs non-secure session cookies; try both if env heuristics mismatch.
  const withSecure = await getToken({ req: reqForToken, secret, secureCookie: true });
  if (withSecure) return withSecure;

  return getToken({ req: reqForToken, secret, secureCookie: false });
}

/** Same fields we attach in `auth` session callback (GitHub user). */
export function userFromAuthToken(token: JWT) {
  return {
    id: token.githubUserId,
    login: token.githubLogin,
    name: (token.name as string | null | undefined) ?? null,
    email: (token.email as string | null | undefined) ?? null,
    image: (token.picture as string | null | undefined) ?? null,
  };
}
