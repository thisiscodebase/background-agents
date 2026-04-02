import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRouteAuthToken } from "@/lib/route-auth";
import { controlPlaneFetch } from "@/lib/control-plane";

/**
 * Cancel in-progress repo image builds for this repo.
 *
 * Prefer control-plane `POST /repo-images/cancel/:owner/:name` when deployed.
 * If that route is missing (older worker), fall back to `GET .../status` +
 * `POST .../build-failed` per building row — same outcome, no worker upgrade required.
 */
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
    const cancelPath = `/repo-images/cancel/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
    const response = await controlPlaneFetch(cancelPath, { method: "POST" });

    if (response.status !== 404) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(data, { status: response.status });
    }

    const statusResponse = await controlPlaneFetch(
      `/repo-images/status?repo_owner=${encodeURIComponent(owner)}&repo_name=${encodeURIComponent(name)}`
    );
    if (!statusResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image status for cancel fallback" },
        { status: 502 }
      );
    }

    const statusData = (await statusResponse.json()) as {
      images?: Array<{ id: string; status: string }>;
    };
    const building = (statusData.images ?? []).filter((i) => i.status === "building");

    let cancelled = 0;
    for (const img of building) {
      const failRes = await controlPlaneFetch("/repo-images/build-failed", {
        method: "POST",
        body: JSON.stringify({ build_id: img.id, error: "cancelled" }),
      });
      if (failRes.ok) {
        cancelled += 1;
      }
    }

    return NextResponse.json({ ok: true, cancelled });
  } catch (error) {
    console.error("Failed to cancel image build:", error);
    return NextResponse.json({ error: "Failed to cancel image build" }, { status: 500 });
  }
}
