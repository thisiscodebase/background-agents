import { verifyInternalToken } from "@open-inspect/shared";
import type { Context } from "hono";
import type { Env } from "./types";
import { resolveRuntimeEnv } from "./runtime-env";

export async function requireInternalAuth(c: Context<{ Bindings: Env }>): Promise<boolean> {
  const secret = resolveRuntimeEnv(c).SANDBOX_API_SECRET;
  if (!secret) {
    return false;
  }

  const ok = await verifyInternalToken(c.req.header("Authorization") ?? null, secret);
  return ok;
}
