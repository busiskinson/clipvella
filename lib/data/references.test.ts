import { describe, expect, it } from "vitest";
import { unreferencedAssets } from "./references";

describe("unreferencedAssets", () => {
  const candidates = ["a", "b", "c", "d"];
  it("keeps assets used as a project source, clip output/thumbnail or on a timeline", () => {
    const refs = { projectSources: ["a"], clipOutputs: ["b"], timelineAssets: ["c"] };
    expect(unreferencedAssets(candidates, refs)).toEqual(["d"]);
  });
  it("returns everything when nothing references the assets", () => {
    expect(unreferencedAssets(candidates, { projectSources: [], clipOutputs: [], timelineAssets: [] })).toEqual(candidates);
  });
});
