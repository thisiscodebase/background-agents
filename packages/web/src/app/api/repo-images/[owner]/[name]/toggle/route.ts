import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRouteAuthToken } from "@/lib/route-auth";
import { controlPlaneFetch } from "@/lib/control-plane";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; name: string }> }
) {
  const token = await getRouteAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { owner, name } = await params;

  try {
    const body = await request.json();

    const response = await controlPlaneFetch(
      `/repo-images/toggle/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to toggle image build:", error);
    return NextResponse.json({ error: "Failed to toggle image build" }, { status: 500 });
  }
}
