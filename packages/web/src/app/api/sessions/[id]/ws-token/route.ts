import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRouteAuthToken, userFromAuthToken } from "@/lib/route-auth";
import { controlPlaneFetch } from "@/lib/control-plane";

/**
 * Generate a WebSocket authentication token for the current user.
 *
 * This endpoint:
 * 1. Verifies the user is authenticated via NextAuth
 * 2. Extracts user info from the session
 * 3. Proxies the request to the control plane to generate a token
 * 4. Returns the token to the client for WebSocket connection
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const routeStart = Date.now();

  const token = await getRouteAuthToken(request);
  const authMs = Date.now() - routeStart;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await params;

  try {
    const user = userFromAuthToken(token);
    const userId = user.id || user.email || "anonymous";

    const fetchStart = Date.now();
    const response = await controlPlaneFetch(`/sessions/${sessionId}/ws-token`, {
      method: "POST",
      body: JSON.stringify({
        userId,
        scmUserId: user.id,
        scmLogin: user.login,
        scmName: user.name,
        scmEmail: user.email,
        scmToken: token.accessToken as string | undefined,
        scmTokenExpiresAt: token.accessTokenExpiresAt as number | undefined,
        scmRefreshToken: token.refreshToken as string | undefined,
      }),
    });
    const fetchMs = Date.now() - fetchStart;
    const totalMs = Date.now() - routeStart;

    console.log(
      `[ws-token] session=${sessionId} total=${totalMs}ms auth=${authMs}ms fetch=${fetchMs}ms status=${response.status}`
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to generate WS token: ${error}`);
      return NextResponse.json({ error: "Failed to generate token" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to generate WS token:", error);
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }
}
