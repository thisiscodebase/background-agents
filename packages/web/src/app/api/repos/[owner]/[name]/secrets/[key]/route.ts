import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRouteAuthToken } from "@/lib/route-auth";
import { controlPlaneFetch } from "@/lib/control-plane";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; name: string; key: string }> }
) {
  const token = await getRouteAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { owner, name, key } = await params;

  try {
    const response = await controlPlaneFetch(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/secrets/${encodeURIComponent(key)}`,
      {
        method: "DELETE",
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Failed to delete repo secret:", error);
    return NextResponse.json({ error: "Failed to delete repo secret" }, { status: 500 });
  }
}
