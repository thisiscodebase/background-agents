import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRouteAuthToken } from "@/lib/route-auth";
import { controlPlaneFetch } from "@/lib/control-plane";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; name: string }> }
) {
  const token = await getRouteAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { owner, name } = await params;

  try {
    const response = await controlPlaneFetch(
      `/repo-images/cancel/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
      { method: "POST" }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to cancel image build:", error);
    return NextResponse.json({ error: "Failed to cancel image build" }, { status: 500 });
  }
}
