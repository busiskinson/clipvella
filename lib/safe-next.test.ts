import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/clipper?project=1")).toBe("/clipper?project=1");
  });
  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "/\t/evil.com", ""])("rejects %j", (bad) => {
    expect(safeNext(bad)).toBe("/");
  });
  it("defaults to / when missing", () => {
    expect(safeNext(null)).toBe("/");
  });
});
