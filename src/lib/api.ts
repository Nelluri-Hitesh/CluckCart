import { AppError } from "./errors";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

type Ctx<P> = { params: Promise<P> };

/** Wraps a route handler so AppErrors become clean JSON responses and nothing leaks. */
export function handler<P = Record<string, never>>(
  fn: (req: Request, ctx: Ctx<P>) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof AppError) return json({ error: e.message }, e.status);
      console.error("API error:", e);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    /* fallthrough */
  }
  throw new AppError("Invalid request body");
}

const buckets = new Map<string, { count: number; reset: number }>();

/** Simple in-memory limiter (per server instance). Use Redis/Upstash when running several instances. */
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  b.count += 1;
  if (b.count > max) throw new AppError("Too many attempts. Please wait a few minutes and try again.", 429);
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
