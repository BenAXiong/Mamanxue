import { db, type ReviewLogEntry } from "./dexie";

export type ReviewLogInput = Omit<ReviewLogEntry, "id">;

export async function appendLog(entry: ReviewLogInput): Promise<number> {
  return db.logs.add(entry);
}

