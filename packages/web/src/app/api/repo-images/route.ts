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
    const [enabledResponse, statusResponse] = await Promise.all([
      controlPlaneFetch("/repo-images/enabled-repos"),
      controlPlaneFetch("/repo-images/status"),
    ]);

    if (!enabledResponse.ok || !statusResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch repo images" }, { status: 502 });
    }

    const enabledData = await enabledResponse.json();
    const statusData = await statusResponse.json();

    const enabledRepos = (enabledData.repos ?? []).map(
      (r: { repoOwner: string; repoName: string }) => `${r.repoOwner}/${r.repoName}`
    );

    return NextResponse.json({
      enabledRepos,
      images: statusData.images ?? [],
    });
  } catch (error) {
    console.error("Failed to fetch repo images:", error);
    return NextResponse.json({ error: "Failed to fetch repo images" }, { status: 500 });
  }
}
