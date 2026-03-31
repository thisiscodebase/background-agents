import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRouteAuthToken, userFromAuthToken } from "@/lib/route-auth";
import { controlPlaneFetch } from "@/lib/control-plane";
import {
  buildControlPlanePath,
  SESSION_CONTROL_PLANE_QUERY_PARAMS,
} from "@/lib/control-plane-query";

export async function GET(request: NextRequest) {
  const routeStart = Date.now();

  const token = await getRouteAuthToken(request);
  const authMs = Date.now() - routeStart;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = buildControlPlanePath(
    "/sessions",
    request.nextUrl.searchParams,
    SESSION_CONTROL_PLANE_QUERY_PARAMS
  );

  try {
    const fetchStart = Date.now();
    const response = await controlPlaneFetch(path);
    const fetchMs = Date.now() - fetchStart;
    const data = await response.json();
    const totalMs = Date.now() - routeStart;

    console.log(
      `[sessions:GET] total=${totalMs}ms auth=${authMs}ms fetch=${fetchMs}ms status=${response.status}`
    );

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getRouteAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const accessToken = token.accessToken as string | undefined;

    // Explicitly pick allowed fields from client body and derive identity
    // from the server-side JWT (not client-supplied data)
    const user = userFromAuthToken(token);
    const userId = user.id || user.email || "anonymous";

    const sessionBody = {
      repoOwner: body.repoOwner,
      repoName: body.repoName,
      model: body.model,
      reasoningEffort: body.reasoningEffort,
      branch: body.branch,
      title: body.title,
      scmToken: accessToken,
      scmRefreshToken: token.refreshToken as string | undefined,
      scmTokenExpiresAt: token.accessTokenExpiresAt as number | undefined,
      scmUserId: user.id,
      userId,
      scmLogin: user.login,
      scmName: user.name,
      scmEmail: user.email,
    };

    const response = await controlPlaneFetch("/sessions", {
      method: "POST",
      body: JSON.stringify(sessionBody),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
