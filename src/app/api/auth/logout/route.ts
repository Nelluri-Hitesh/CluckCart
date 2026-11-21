import { handler, json } from "@/lib/api";
import { destroySession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  await destroySession();
  return json({ ok: true });
});
