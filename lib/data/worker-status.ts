/** The worker beats every 15 s; treat it as offline after 45 s of silence. */
export const WORKER_TIMEOUT_MS = 45_000;

export function isWorkerOnline(lastSeen: string | null | undefined, now: number = Date.now()): boolean {
  if (!lastSeen) return false;
  return now - Date.parse(lastSeen) < WORKER_TIMEOUT_MS;
}
