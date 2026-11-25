import { describe, expect, it } from "vitest";
import { validateVideo } from "./upload";

const fakeFile = (sizeMb: number, type: string, name = "clip.mp4") =>
  ({ name, type, size: Math.round(sizeMb * 1024 * 1024) }) as File;

describe("validateVideo", () => {
  it("rejects files over the limit with the size in the message", () => {
    expect(validateVideo(fakeFile(60, "video/mp4"), 50)).toEqual({
      ok: false,
      message: "This file is 60 MB. The upload limit is 50 MB.",
    });
  });
  it("rejects non-video files", () => {
    expect(validateVideo(fakeFile(1, "text/plain", "notes.txt"), 50)).toEqual({
      ok: false,
      message: "That file isn't a video. Use MP4, MOV or WebM.",
    });
  });
  it("rejects empty files", () => {
    expect(validateVideo(fakeFile(0, "video/mp4"), 50)).toEqual({ ok: false, message: "That file is empty." });
  });
  it("accepts a 10 MB mp4", () => {
    expect(validateVideo(fakeFile(10, "video/mp4"), 50)).toEqual({ ok: true });
  });
});
