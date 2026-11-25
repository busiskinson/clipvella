import { describe, expect, it } from "vitest";
import { toSrt, toVtt } from "./captions-export";

const lines = [
  { id: "c1", start: 1, end: 2.5, text: "Hello there" },
  { id: "c2", start: 62.04, end: 3725.5, text: "Second line" },
];

describe("caption export", () => {
  it("writes SRT with comma milliseconds and numbered cues", () => {
    expect(toSrt(lines)).toBe("1\n00:00:01,000 --> 00:00:02,500\nHello there\n\n2\n00:01:02,040 --> 01:02:05,500\nSecond line\n");
  });
  it("writes VTT with a header and dot milliseconds", () => {
    expect(toVtt(lines)).toBe("WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nHello there\n\n00:01:02.040 --> 01:02:05.500\nSecond line\n");
  });
});
