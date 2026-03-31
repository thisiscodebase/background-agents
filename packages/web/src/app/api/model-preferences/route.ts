import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRouteAuthToken } from "@/lib/route-auth";
import { controlPlaneFetch } from "@/lib/control-plane";

export async function GET(req: NextRequest) {
  const token = await getRouteAuthToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await controlPlaneFetch("/model-preferences");
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to fetch model preferences:", error);
    return NextResponse.json({ error: "Failed to fetch model preferences" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = await getRouteAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const response = await controlPlaneFetch("/model-preferences", {
      method: "PUT",
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to update model preferences:", error);
    return NextResponse.json({ error: "Failed to update model preferences" }, { status: 500 });
  }
}
