import { sql } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { runSeed } from "@/db/seed";

let started: Promise<void> | null = null;

/** First-run setup: seeds the catalogue, zones, slots, settings and starter accounts when the DB is empty. */
export function ensureSeeded() {
  if (!started) {
    started = (async () => {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(categories);
      if (n === 0) await runSeed();
    })().catch((e) => {
      started = null;
      throw e;
    });
  }
  return started;
}
