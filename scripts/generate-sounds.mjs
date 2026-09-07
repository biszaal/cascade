/**
 * Synthesise the game's sound set. Run with `npm run sounds`.
 *
 * These are generated rather than sourced so they are tiny, licence-free, and tuned to
 * the board's material: short wooden knocks, not UI beeps. Output is 16-bit mono PCM.
 *
 * The design rule is that a sound should read as a physical event on a board - a disc
 * landing on felt - so every voice is a fast attack with an exponential decay and a
 * slightly inharmonic partial, which is what stops it sounding like a sine-wave bleep.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44100;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sound');

/** A struck-wood voice: fundamental plus two quiet inharmonic partials, decaying fast. */
function knock({ freq, durationMs, decay, gain = 0.5, noise = 0.06, partials = [2.76, 5.4] }) {
  const length = Math.floor((durationMs / 1000) * SAMPLE_RATE);
  const samples = new Float64Array(length);
  // A fixed pseudo-random sequence keeps the output byte-identical between runs.
  let seed = 12345;
  const rand = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed / 0x3fffffff - 1;
  };

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-decay * t);
    let value = Math.sin(2 * Math.PI * freq * t);
    // Inharmonic partials are what make it wood rather than a tuning fork.
    partials.forEach((ratio, index) => {
      value += (0.32 / (index + 1)) * Math.sin(2 * Math.PI * freq * ratio * t);
    });
    // A breath of noise in the attack supplies the transient "click" of contact.
    value += rand() * noise * Math.exp(-90 * t);
    samples[i] = value * envelope * gain;
  }
  return samples;
}

/** Two or more knocks in sequence, for chimes and arpeggios. */
function sequence(voices) {
  const total = Math.max(...voices.map((v) => Math.floor((v.atMs / 1000) * SAMPLE_RATE) + v.samples.length));
  const out = new Float64Array(total);
  for (const voice of voices) {
    const offset = Math.floor((voice.atMs / 1000) * SAMPLE_RATE);
    for (let i = 0; i < voice.samples.length; i++) out[offset + i] += voice.samples[i];
  }
  return out;
}

/** Fade the last few milliseconds so the file cannot end on a click. */
function fadeOut(samples, ms = 8) {
  const fade = Math.min(Math.floor((ms / 1000) * SAMPLE_RATE), samples.length);
  for (let i = 0; i < fade; i++) {
    samples[samples.length - fade + i] *= 1 - i / fade;
  }
  return samples;
}

function encodeWav(samples) {
  const length = samples.length;
  const buffer = Buffer.alloc(44 + length * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);          // PCM chunk size
  buffer.writeUInt16LE(1, 20);           // format: PCM
  buffer.writeUInt16LE(1, 22);           // channels: mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);           // block align
  buffer.writeUInt16LE(16, 34);          // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(length * 2, 40);

  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  // Normalise with headroom so nothing clips on a phone speaker.
  const scale = peak > 0 ? 0.82 / peak : 0;

  for (let i = 0; i < length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] * scale));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

const sounds = {
  // Picking a token up: light, high, barely there.
  lift: fadeOut(knock({ freq: 620, durationMs: 90, decay: 46, gain: 0.34, noise: 0.05 })),

  // A disc landing on felt. This one plays most, so it is the quietest and driest.
  place: fadeOut(knock({ freq: 300, durationMs: 150, decay: 30, gain: 0.5, noise: 0.09 })),

  // A lane finished: a rising perfect fifth, the smallest interval that reads as "yes".
  complete: fadeOut(
    sequence([
      { atMs: 0, samples: knock({ freq: 523.25, durationMs: 260, decay: 15, gain: 0.42, noise: 0.02 }) },
      { atMs: 85, samples: knock({ freq: 783.99, durationMs: 300, decay: 13, gain: 0.4, noise: 0.02 }) },
    ]),
  ),

  // A refused move: low, dull, over quickly. Never harsh - the player made an honest
  // mistake and does not need to be scolded.
  invalid: fadeOut(knock({ freq: 132, durationMs: 130, decay: 40, gain: 0.44, noise: 0.05, partials: [1.9] })),

  // Board solved: a major triad, unhurried.
  win: fadeOut(
    sequence([
      { atMs: 0, samples: knock({ freq: 523.25, durationMs: 420, decay: 9, gain: 0.34, noise: 0.015 }) },
      { atMs: 110, samples: knock({ freq: 659.25, durationMs: 420, decay: 9, gain: 0.34, noise: 0.015 }) },
      { atMs: 220, samples: knock({ freq: 783.99, durationMs: 560, decay: 7, gain: 0.38, noise: 0.015 }) },
    ]),
  ),
};

mkdirSync(outDir, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
  const wav = encodeWav(samples);
  writeFileSync(join(outDir, `${name}.wav`), wav);
  console.log(`  ${name.padEnd(9)} ${String((samples.length / SAMPLE_RATE * 1000).toFixed(0)).padStart(4)}ms  ${(wav.length / 1024).toFixed(1)}KB`);
}
console.log(`\nWrote ${Object.keys(sounds).length} sounds to assets/sound`);
