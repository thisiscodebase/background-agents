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
 * Resolve the signed-in user from the incoming Route Handler request.
 *
 * In the App Router, `getServerSession(authOptions)` often reads an empty cookie store for
 * client-initiated fetches while `/api/auth/*` still sees cookies from the real `Request`.
 * `getToken({ req })` uses the request's cookies and matches browser session state.
 */
export async function getRouteAuthToken(req: NextRequest): Promise<JWT | null> {
  return getToken({ req, secret: authSecret() });
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
