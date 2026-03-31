// Import bundled app: Vercel does not ship `src/` to /var/task; `npm run build` must run first (vercel.json buildCommand).
import app from "../dist/index.js";
import { handle } from "hono/vercel";

/** Default serverless limit is too low for Sandbox.create + git clone; raise to plan maximum (see vercel.json). */
export const maxDuration = 300;

const handler = handle(app);

function rewriteToRootPath(request: Request): Request {
  const url = new URL(request.url);

  // Vercel functions under /api/*; strip this prefix so Hono routes remain /api-*.
  if (url.pathname.startsWith("/api/")) {
    url.pathname = url.pathname.slice(4);
  }

  return new Request(url, request);
}

function routeRequest(request: Request, context: unknown) {
  return handler(rewriteToRootPath(request), context as never);
}

export const GET = routeRequest;
export const POST = routeRequest;
export const PUT = routeRequest;
export const PATCH = routeRequest;
export const DELETE = routeRequest;
export const OPTIONS = routeRequest;
