import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRouteAuthToken } from "@/lib/route-auth";
import { controlPlaneFetch } from "@/lib/control-plane";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getRouteAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const response = await controlPlaneFetch(
      `/integration-settings/${encodeURIComponent(id)}/repos`
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to fetch repo settings:", error);
    return NextResponse.json({ error: "Failed to fetch repo settings" }, { status: 500 });
  }
}
