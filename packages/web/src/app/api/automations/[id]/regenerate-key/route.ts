import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRouteAuthToken } from "@/lib/route-auth";
import { controlPlaneFetch } from "@/lib/control-plane";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getRouteAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.text();
    const response = await controlPlaneFetch(`/automations/${id}/regenerate-key`, {
      method: "POST",
      ...(body ? { headers: { "Content-Type": "application/json" }, body } : {}),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to regenerate key:", error);
    return NextResponse.json({ error: "Failed to regenerate key" }, { status: 500 });
  }
}
