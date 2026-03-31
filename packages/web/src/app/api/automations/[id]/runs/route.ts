import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRouteAuthToken } from "@/lib/route-auth";
import { controlPlaneFetch } from "@/lib/control-plane";
import { buildControlPlanePath } from "@/lib/control-plane-query";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getRouteAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const path = buildControlPlanePath(`/automations/${id}/runs`, request.nextUrl.searchParams);

  try {
    const response = await controlPlaneFetch(path);
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to fetch automation runs:", error);
    return NextResponse.json({ error: "Failed to fetch automation runs" }, { status: 500 });
  }
}
