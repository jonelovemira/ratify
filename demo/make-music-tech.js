#!/usr/bin/env node
// Original TECH-style bed for the Ratify demo film.
// Minimal electronic: 122 BPM, A minor, filtered saw/square 16th arpeggio,
// soft sub pulse on the beat (no kick), warm low pad with subtle sidechain
// pumping, filtered noise riser into the 25-grid section. Synthesized from
// scratch in code — no samples, no recordings, no third-party audio, no
// network, no model calls.
//
// License/origin: original work created for this prototype by this script;
// free to reuse with the film and safe for YouTube (no copyrighted material).
//
// Usage: node demo/make-music-tech.js demo/music-tech.wav

'use strict';

const fs = require('node:fs');

const SR = 48000;
const DURATION = 1255 / 30; // 41.8333s — exactly the film length
const N = Math.round(SR * DURATION);

const BPM = 122;
const BEAT = 60 / BPM;
const STEP = BEAT / 4; // 16th note
const BAR = BEAT * 4;

const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const smooth = (x) => x * x * (3 - 2 * x);
const fade = (t, start, len) => smooth(clamp((t - start) / len, 0, 1));
const remap = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

// A minor / F major / C major / G major, one chord per bar, arpeggio tones.
const CHORDS = [
  { bass: 55.0, notes: [220.0, 261.6256, 329.6276, 440.0] }, // Am
  { bass: 43.6535, notes: [174.6141, 220.0, 261.6256, 349.2282] }, // F
  { bass: 65.4064, notes: [261.6256, 329.6276, 392.0, 523.2511] }, // C
  { bass: 49.0, notes: [196.0, 246.9417, 293.6648, 392.0] }, // G
];

function wavStereo(left, right) {
  const data = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i += 1) {
    data.writeInt16LE(Math.round(clamp(left[i], -1, 1) * 32767), i * 4);
    data.writeInt16LE(Math.round(clamp(right[i], -1, 1) * 32767), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22); header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function build() {
  const left = new Float64Array(N);
  const right = new Float64Array(N);

  // Structure: sparse intro (0–12.5s), build (12.5–32s), resolve (32–41.83s)
  const energyAt = (t) => {
    if (t < 2) return 0;
    if (t < 12.5) return fade(t, 2, 6) * 0.55;
    if (t < 30.5) return 0.55 + 0.45 * fade(t, 12.5, 2.5);
    if (t < 32) return 0.9;
    if (t < 39.5) return 0.62;
    return 0.62 * (1 - fade(t, 39.5, 2.0));
  };
  const buildAt = (t) => (t >= 12.5 && t < 32 ? 1 : 0);

  // --- 16th-note filtered saw/square arpeggio --------------------------------
  const stepCount = Math.floor(DURATION / STEP);
  for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
    const t0 = stepIndex * STEP + 0.006;
    if (t0 > DURATION - 0.4) break;
    const energy = energyAt(t0);
    if (energy <= 0.001) continue;
    const barIndex = Math.floor(t0 / BAR);
    const chord = CHORDS[barIndex % CHORDS.length];
    const tones = [chord.notes[0], chord.notes[1], chord.notes[2], chord.notes[3], chord.notes[2], chord.notes[1], chord.notes[2], chord.notes[3]];
    const freq = tones[stepIndex % tones.length] * (stepIndex % 16 === 14 ? 2 : 1);
    const accent = stepIndex % 4 === 0 ? 1 : stepIndex % 4 === 2 ? 0.82 : 0.62;
    const structure = t0 < 12.5 ? 0.55 + 0.45 * energy : energy;
    const amp = 0.055 * accent * structure * (t0 >= 32 ? 0.0 : 1);
    if (amp <= 0) continue;
    const pan = stepIndex % 2 === 0 ? -0.18 : 0.18;
    const length = Math.round(Math.min(0.34, DURATION - t0) * SR);
    const startSample = Math.round(t0 * SR);
    let lpL = 0;
    let lpR = 0;
    for (let k = 0; k < length; k += 1) {
      const i = startSample + k;
      if (i >= N) break;
      const t = k / SR;
      const env = Math.exp(-t / 0.1) * (1 - Math.exp(-t / 0.004));
      const brightness = Math.exp(-t / 0.09);
      const cutoff = 380 + 3600 * brightness; // bright attack, filtered tail
      const alpha = 1 - Math.exp(-TAU * cutoff / SR);
      const phase = freq * t;
      const frac = phase - Math.floor(phase);
      const saw = 2 * frac - 1;
      const square = frac < 0.5 ? 1 : -1;
      const rawL = (saw * 0.8 + square * 0.2) * env;
      const rawR = rawL;
      lpL += alpha * (rawL - lpL);
      lpR += alpha * (rawR - lpR);
      left[i] += lpL * amp * (1 - pan);
      right[i] += lpR * amp * (1 + pan);
    }
  }

  // --- soft sub pulse on the beat (no kick transient) ------------------------
  const beatCount = Math.floor(DURATION / BEAT);
  for (let beatIndex = 0; beatIndex < beatCount; beatIndex += 1) {
    const t0 = beatIndex * BEAT;
    const energy = energyAt(t0);
    if (energy <= 0.05) continue;
    const barIndex = Math.floor(t0 / BAR);
    const chord = CHORDS[barIndex % CHORDS.length];
    const freq = chord.bass;
    const amp = 0.13 * energy * (t0 >= 32 ? 0.2 : 1);
    const length = Math.round(Math.min(0.3, DURATION - t0) * SR);
    const startSample = Math.round(t0 * SR);
    for (let k = 0; k < length; k += 1) {
      const i = startSample + k;
      if (i >= N) break;
      const t = k / SR;
      const env = Math.exp(-t / 0.11) * (1 - Math.exp(-t / 0.008));
      const value = (Math.sin(TAU * freq * t) + 0.22 * Math.sin(TAU * 2 * freq * t)) * env * amp;
      left[i] += value;
      right[i] += value;
    }
  }

  // --- warm low pad with subtle sidechain pumping ----------------------------
  for (let i = 0; i < N; i += 1) {
    const t = i / SR;
    const energy = energyAt(t);
    if (energy <= 0.001) continue;
    const barIndex = Math.floor(t / BAR);
    const chord = CHORDS[barIndex % CHORDS.length];
    // bar-local crossfade so pads change with the harmony, no clicks
    const local = (t - barIndex * BAR) / BAR;
    const env = smooth(clamp(local / 0.22, 0, 1)) * (1 - smooth(clamp((local - 0.78) / 0.22, 0, 1)));
    const pump = 1 - 0.34 * Math.exp(-(t % BEAT) / 0.1);
    const cutoff = 620 + (buildAt(t) ? 480 : 180) * (1 - remap(t, 32, 41.8));
    const alpha = 1 - Math.exp(-TAU * cutoff / SR);
    let lpL = 0;
    let lpR = 0;
    for (const [index, freq] of chord.notes.entries()) {
      const tone = Math.sin(TAU * freq * t) + 0.32 * Math.sin(TAU * 2 * freq * t) + 0.1 * Math.sin(TAU * 3 * freq * t);
      const width = 0.35 + 0.1 * index;
      lpL += alpha * (tone - lpL);
      lpR += alpha * (tone - lpR);
      left[i] += lpL * 0.012 * env * energy * pump * (1 - width * 0.3);
      right[i] += lpR * 0.012 * env * energy * pump * (1 + width * 0.3);
    }
  }

  // --- filtered noise riser into the 25-grid section (≈23.6s → 26.3s) -------
  let noiseSeed = 0x9e3779b9;
  const noise = () => {
    noiseSeed ^= noiseSeed << 13; noiseSeed ^= noiseSeed >>> 17; noiseSeed ^= noiseSeed << 5;
    return ((noiseSeed >>> 0) / 0xffffffff) * 2 - 1;
  };
  const riserStart = 23.6;
  const riserEnd = 26.35;
  let lp = 0;
  for (let i = Math.round(riserStart * SR); i < Math.round(riserEnd * SR) && i < N; i += 1) {
    const t = i / SR;
    const p = remap(t, riserStart, riserEnd);
    const cutoff = 260 + 6800 * p * p;
    const alpha = 1 - Math.exp(-TAU * cutoff / SR);
    const high = noise();
    lp += alpha * (high - lp);
    const band = high - lp; // high-passed noise
    const env = Math.sin(Math.PI * p) ** 1.6;
    const amp = 0.055 * env;
    left[i] += band * amp;
    right[i] += band * amp * 0.92;
  }

  // --- short stereo delay on the arp for space ------------------------------
  const taps = [[0.184, 0.2], [0.368, 0.11], [0.552, 0.06]];
  const wetL = new Float64Array(N);
  const wetR = new Float64Array(N);
  for (const [seconds, gain] of taps) {
    const offset = Math.round(seconds * SR);
    for (let i = offset; i < N; i += 1) {
      wetL[i] += left[i - offset] * gain;
      wetR[i] += right[i - offset] * gain * 0.94;
    }
  }
  for (let i = 0; i < N; i += 1) {
    left[i] += wetL[i];
    right[i] += wetR[i];
  }

  // --- fades + level target (-25 dB mean, before sidechain ducking) --------
  for (let i = 0; i < N; i += 1) {
    const t = i / SR;
    const fadeIn = fade(t, 0, 0.9);
    const fadeOut = 1 - fade(t, DURATION - 1.6, 1.6);
    left[i] *= fadeIn * fadeOut;
    right[i] *= fadeIn * fadeOut;
  }
  let sumSq = 0;
  let peak = 0;
  for (let i = 0; i < N; i += 1) {
    sumSq += left[i] * left[i] + right[i] * right[i];
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const rms = Math.sqrt(sumSq / (N * 2)); // ffmpeg volumedetect's mean_volume is RMS-based
  const targetRms = 10 ** (-25 / 20);
  let scale = rms > 0 ? targetRms / rms : 1;
  if (peak * scale > 0.72) scale = 0.72 / peak; // keep headroom for the VO mix
  for (let i = 0; i < N; i += 1) {
    left[i] *= scale;
    right[i] *= scale;
  }
  return { left, right };
}

const { left, right } = build();
fs.writeFileSync(process.argv[2] || 'demo/music-tech.wav', wavStereo(left, right));
console.log(`wrote ${process.argv[2] || 'demo/music-tech.wav'} — ${DURATION.toFixed(3)}s, ${SR}Hz stereo, original TECH bed, RMS target -25 dBFS`);
