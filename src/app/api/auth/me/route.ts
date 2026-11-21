import { handler, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handler(async () => json({ user: await getCurrentUser() }));
