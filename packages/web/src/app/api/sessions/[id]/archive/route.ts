import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRouteAuthToken, userFromAuthToken } from "@/lib/route-auth";
import { controlPlaneFetch } from "@/lib/control-plane";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getRouteAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = userFromAuthToken(token);
  const userId = user.id || user.email || "anonymous";

  try {
    const response = await controlPlaneFetch(`/sessions/${id}/archive`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Archive session error:", error);
    return NextResponse.json({ error: "Failed to archive session" }, { status: 500 });
  }
}
