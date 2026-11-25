import { describe, expect, it } from "vitest";
import { isWorkerOnline } from "./worker-status";

describe("isWorkerOnline", () => {
  const now = Date.parse("2026-11-25T12:00:00Z");
  it("is online 44 s after the last heartbeat", () => {
    expect(isWorkerOnline("2026-11-25T11:59:16Z", now)).toBe(true);
  });
  it("is offline 46 s after the last heartbeat", () => {
    expect(isWorkerOnline("2026-11-25T11:59:14Z", now)).toBe(false);
  });
  it("is offline when the worker has never reported", () => {
    expect(isWorkerOnline(null, now)).toBe(false);
  });
});
