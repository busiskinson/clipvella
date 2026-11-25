"use client";

/**
 * Procedural Web Audio sketch used to audition Music Studio settings.
 * This is NOT AI music generation — it plays a simple chord loop derived from
 * genre / mood / bpm so the player controls are functional until a real API exists.
 */

import { seeded } from "./format";

const MINOR_MOODS = new Set(["Dark", "Melancholic", "Dreamy", "Epic"]);

// semitone offsets from root for each chord in the progression
const MAJOR_PROG = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];
const MINOR_PROG = [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]];

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export interface SynthTrack {
  bpm: number;
  seed: number;
  mood: string;
  genre: string;
  duration: number;
}

export class DemoSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beat = 0;
  private startedAt = 0;
  private offset = 0;
  private track: SynthTrack | null = null;
  volume = 0.7;

  get playing() {
    return this.timer !== null;
  }

  /** seconds elapsed in the current track */
  get position() {
    if (!this.ctx || !this.playing) return this.offset;
    return this.offset + (this.ctx.currentTime - this.startedAt);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v * 0.35, this.ctx.currentTime, 0.05);
  }

  async play(track: SynthTrack, from = 0) {
    this.stop();
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.track = track;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume * 0.35;
    this.master.connect(this.ctx.destination);
    const spb = 60 / track.bpm;
    this.offset = from;
    this.beat = Math.floor(from / spb);
    this.startedAt = this.ctx.currentTime + 0.05;
    this.nextBeat = this.startedAt;
    this.timer = setInterval(() => this.schedule(), 50);
    this.schedule();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.ctx && this.master) {
      this.offset = this.position;
      const m = this.master;
      m.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      setTimeout(() => m.disconnect(), 200);
    }
    this.master = null;
  }

  dispose() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  private schedule() {
    const ctx = this.ctx;
    const t = this.track;
    if (!ctx || !t || !this.master) return;
    const spb = 60 / t.bpm;
    const minor = MINOR_MOODS.has(t.mood);
    const prog = minor ? MINOR_PROG : MAJOR_PROG;
    const root = 48 + (t.seed % 7);
    const rnd = seeded(t.seed);
    const pattern = Array.from({ length: 8 }, () => Math.floor(rnd() * 3));

    while (this.nextBeat < ctx.currentTime + 0.2) {
      const elapsed = this.beat * spb;
      if (elapsed >= t.duration) {
        this.stop();
        this.offset = 0;
        return;
      }
      const chord = prog[Math.floor(this.beat / 4) % prog.length];
      const time = this.nextBeat;

      // pad on the first beat of each bar
      if (this.beat % 4 === 0) chord.forEach((n) => this.voice(midiToHz(root + n + 12), time, spb * 4, "triangle", 0.12));
      // bass on every beat
      this.voice(midiToHz(root + chord[0] - 12), time, spb * 0.9, "sine", 0.35);
      // arpeggio eighth notes
      for (let h = 0; h < 2; h++) {
        const n = chord[pattern[(this.beat * 2 + h) % 8]];
        this.voice(midiToHz(root + n + 24), time + h * (spb / 2), spb * 0.4, t.genre === "Lo-fi" || t.genre === "Acoustic" ? "sine" : "square", 0.05);
      }
      // kick on beats 1 & 3 (skip for ambient)
      if (t.genre !== "Ambient" && this.beat % 2 === 0) this.kick(time);

      this.nextBeat += spb;
      this.beat += 1;
    }
  }

  private voice(freq: number, time: number, dur: number, type: OscillatorType, gain: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(filter).connect(g).connect(this.master!);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  private kick(time: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.15);
    g.gain.setValueAtTime(0.6, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    osc.connect(g).connect(this.master!);
    osc.start(time);
    osc.stop(time + 0.25);
  }
}
