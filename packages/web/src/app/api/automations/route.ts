import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRouteAuthToken, userFromAuthToken } from "@/lib/route-auth";
import { controlPlaneFetch } from "@/lib/control-plane";
import { buildControlPlanePath } from "@/lib/control-plane-query";

export async function GET(request: NextRequest) {
  const token = await getRouteAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = buildControlPlanePath("/automations", request.nextUrl.searchParams);

  try {
    const response = await controlPlaneFetch(path);
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to fetch automations:", error);
    return NextResponse.json({ error: "Failed to fetch automations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getRouteAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const user = userFromAuthToken(token);
    const userId = user.id || user.email || "anonymous";

    const response = await controlPlaneFetch("/automations", {
      method: "POST",
      body: JSON.stringify({ ...body, userId }),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to create automation:", error);
    return NextResponse.json({ error: "Failed to create automation" }, { status: 500 });
  }
}
