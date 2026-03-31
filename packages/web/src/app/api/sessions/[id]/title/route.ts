import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRouteAuthToken, userFromAuthToken } from "@/lib/route-auth";
import { controlPlaneFetch } from "@/lib/control-plane";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getRouteAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = userFromAuthToken(token);
  const userId = user.id || user.email || "anonymous";

  let body: { title?: string };
  try {
    body = (await request.json()) as { title?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const response = await controlPlaneFetch(`/sessions/${id}/title`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, title: body.title }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Update session title error:", error);
    return NextResponse.json({ error: "Failed to update the session title" }, { status: 500 });
  }
}
