/**
 * Synthesise the game's sound set and its background music. Run with `npm run sounds`.
 *
 * These are generated rather than sourced so they are tiny, licence-free, and byte-identical
 * between runs. Output is 16-bit mono PCM WAV.
 *
 * The effects are cartoon voices - pitch-swept bloops, boinks and bells - each a fast attack
 * and a quick decay, so they read as playful events rather than UI beeps. The music is a slow
 * music-box tune over soft pads, rendered circularly so it loops without a seam.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SFX_RATE = 44100;
/** Music is long, so it runs at half rate: nothing in a soft pad needs the top octave. */
const MUSIC_RATE = 22050;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sound');

/** A fixed pseudo-random sequence keeps the output byte-identical between runs. */
function noiseSource(seed = 12345) {
  return () => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed / 0x3fffffff - 1;
  };
}

/** Note name to frequency, e.g. "A4" -> 440. */
function note(name) {
  const [, letter, octave] = /^([A-G]#?)(\d)$/.exec(name);
  const semitone = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }[letter];
  return 440 * Math.pow(2, (semitone + (Number(octave) + 1) * 12 - 69) / 12);
}

function wave(shape, phase) {
  const p = phase - Math.floor(phase);
  if (shape === 'triangle') return 1 - 4 * Math.abs(p - 0.5);
  return Math.sin(2 * Math.PI * p);
}

/**
 * One cartoon voice: a tone whose pitch glides exponentially from `from` to `to` over
 * `glideMs`, with optional vibrato, a short attack and an exponential decay.
 *
 * `partials` are [ratio, amplitude] pairs driven from the same phase, so they glide with the
 * fundamental. `wah` swells a low-pass filter open and shut over the note - the muted-trumpet
 * "wah" that makes a sad slide sound comic rather than mournful.
 */
function blip({
  from,
  to = from,
  durationMs,
  glideMs = durationMs,
  decay = 20,
  attackMs = 4,
  shape = 'sine',
  vibrato = 0,
  vibratoHz = 6,
  partials = [],
  wah = false,
  gain = 1,
  rate = SFX_RATE,
}) {
  const length = Math.floor((durationMs / 1000) * rate);
  const out = new Float64Array(length);
  const glide = Math.max(0.001, glideMs / 1000);
  const attack = Math.max(0.001, attackMs / 1000);
  // Every voice fades over its last few milliseconds. A note cut off while it is still
  // ringing - the first half of the "wah-wah" - otherwise ends on an audible click.
  const release = Math.min(length, Math.floor(0.015 * rate));
  let phase = 0;
  let filtered = 0;

  for (let i = 0; i < length; i++) {
    const t = i / rate;
    const freq =
      from * Math.pow(to / from, Math.min(1, t / glide)) * (1 + vibrato * Math.sin(2 * Math.PI * vibratoHz * t));
    // Accumulate phase rather than computing sin(f·t): with a moving f, the latter jumps.
    phase += freq / rate;

    let value = wave(shape, phase);
    for (const [ratio, amp] of partials) value += amp * Math.sin(2 * Math.PI * phase * ratio);

    if (wah) {
      const open = Math.sin(Math.PI * (i / length));
      const cutoff = 300 + 2200 * open;
      filtered += (1 - Math.exp((-2 * Math.PI * cutoff) / rate)) * (value - filtered);
      value = filtered * 1.6;
    }

    const fade = i >= length - release ? (length - i) / release : 1;
    out[i] = value * Math.min(1, t / attack) * Math.exp(-decay * t) * fade * gain;
  }
  return out;
}

/** Noise whose brightness sweeps upward: something being swept off the board. */
function swoosh({ durationMs, fromHz = 300, toHz = 5000, gain = 1, rate = SFX_RATE }) {
  const rand = noiseSource(777);
  const length = Math.floor((durationMs / 1000) * rate);
  const out = new Float64Array(length);
  let low = 0;
  let rumble = 0;
  for (let i = 0; i < length; i++) {
    const k = i / length;
    const cutoff = fromHz * Math.pow(toHz / fromHz, k);
    low += (1 - Math.exp((-2 * Math.PI * cutoff) / rate)) * (rand() - low);
    // Subtracting a much slower copy keeps it airy rather than a rumble.
    rumble += 0.02 * (low - rumble);
    out[i] = (low - rumble) * Math.sin(Math.PI * k) * gain;
  }
  return out;
}

/** Two or more voices in sequence, for arpeggios and fanfares. */
function sequence(voices) {
  const total = Math.max(...voices.map((v) => Math.floor((v.atMs / 1000) * SFX_RATE) + v.samples.length));
  const out = new Float64Array(total);
  for (const voice of voices) {
    const offset = Math.floor((voice.atMs / 1000) * SFX_RATE);
    for (let i = 0; i < voice.samples.length; i++) out[offset + i] += voice.samples[i];
  }
  return out;
}

/** Fade the last few milliseconds so the file cannot end on a click. */
function fadeOut(samples, ms = 8) {
  const fade = Math.min(Math.floor((ms / 1000) * SFX_RATE), samples.length);
  for (let i = 0; i < fade; i++) {
    samples[samples.length - fade + i] *= 1 - i / fade;
  }
  return samples;
}

/**
 * Encode as WAV, normalised so the loudest sample hits `peak`.
 *
 * Every sound is normalised separately, so `peak` - not a voice's gain - is what sets how
 * loud one sound is against another. A button tap must never be as loud as a win.
 */
function encodeWav(samples, { rate = SFX_RATE, peak = 0.82 } = {}) {
  const length = samples.length;
  const buffer = Buffer.alloc(44 + length * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);          // PCM chunk size
  buffer.writeUInt16LE(1, 20);           // format: PCM
  buffer.writeUInt16LE(1, 22);           // channels: mono
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);           // block align
  buffer.writeUInt16LE(16, 34);          // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(length * 2, 40);

  let loudest = 0;
  for (const sample of samples) loudest = Math.max(loudest, Math.abs(sample));
  const scale = loudest > 0 ? peak / loudest : 0;

  for (let i = 0; i < length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] * scale));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

/** A short rising bubble on a pitch, for arpeggios. */
function bubble(freq, atMs, { durationMs = 220, gain = 1 } = {}) {
  return {
    atMs,
    samples: blip({ from: freq * 0.8, to: freq, glideMs: 25, durationMs, decay: 18, partials: [[2, 0.12]], gain }),
  };
}

/** A small struck bell. Inharmonic partials are what make it a bell and not a beep. */
function bell(freq, { durationMs = 520, decay = 7, gain = 1 } = {}) {
  return blip({ from: freq, durationMs, decay, attackMs: 1.5, partials: [[2.76, 0.28], [5.4, 0.1]], gain });
}

/** A soft horn note that scoops up into pitch, for the fanfare. */
function horn(freq, atMs, durationMs, decay) {
  return {
    atMs,
    samples: blip({
      from: freq * 0.97,
      to: freq,
      glideMs: 30,
      durationMs,
      decay,
      shape: 'triangle',
      // A sine on the fundamental rounds off the triangle's buzz.
      partials: [[1, 0.6]],
      vibrato: 0.006,
      vibratoHz: 5.5,
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// Music

/** A pad voice: slow sin² swell in, hold, cos² release - so consecutive chords crossfade. */
function pad(freq, holdSamples, releaseSamples, rate) {
  const attack = 1.4 * rate;
  const out = new Float64Array(holdSamples + releaseSamples);
  for (let i = 0; i < out.length; i++) {
    const t = i / rate;
    let env;
    if (i < attack) env = Math.sin((i / attack) * (Math.PI / 2)) ** 2;
    else if (i < holdSamples) env = 1;
    else env = Math.cos(Math.min(1, (i - holdSamples) / releaseSamples) * (Math.PI / 2)) ** 2;
    const tone =
      Math.sin(2 * Math.PI * freq * t) +
      0.25 * wave('triangle', freq * 1.004 * t) +
      0.12 * Math.sin(2 * Math.PI * freq * 2 * t);
    // A slow swell in loudness, so a held chord breathes instead of droning.
    out[i] = tone * env * (0.88 + 0.12 * Math.sin(2 * Math.PI * 0.25 * t));
  }
  return out;
}

function renderMusic() {
  const rate = MUSIC_RATE;
  // 72 BPM at 22.05 kHz is exactly 18375 samples a beat, so every bar lands on a whole sample
  // and the loop length is exact.
  const beat = (rate * 60) / 72;
  const bars = 16;
  const total = beat * 4 * bars;

  const pads = new Float64Array(total);
  const bass = new Float64Array(total);
  const melody = new Float64Array(total);

  // Every voice is mixed in modulo the loop length: a tail that rings past the end lands at
  // the start, which is exactly what it would overlap when the loop comes round.
  const mixIn = (target, offset, samples, gain = 1) => {
    for (let i = 0; i < samples.length; i++) target[(offset + i) % total] += samples[i] * gain;
  };

  // Cmaj7 -> Am7 -> Fmaj7 -> G6, two bars each, twice. Voiced around middle C so a phone
  // speaker, which drops everything below about 150 Hz, still carries the harmony.
  const chords = [
    { root: 'C3', voicing: ['C4', 'E4', 'G4', 'B4'] },
    { root: 'A2', voicing: ['A3', 'C4', 'E4', 'G4'] },
    { root: 'F2', voicing: ['F3', 'A3', 'C4', 'E4'] },
    { root: 'G2', voicing: ['G3', 'B3', 'D4', 'E4'] },
  ];
  const chordBars = 2;
  for (let c = 0; c < bars / chordBars; c++) {
    const chord = chords[c % chords.length];
    const start = c * chordBars * 4 * beat;
    const hold = chordBars * 4 * beat;
    for (const name of chord.voicing) mixIn(pads, start, pad(note(name), hold, Math.floor(1.6 * rate), rate));
    for (let bar = 0; bar < chordBars; bar++) {
      for (const [atBeat, gain] of [[0, 1], [2, 0.6]]) {
        const pluck = blip({ from: note(chord.root), durationMs: 2400, decay: 1.6, attackMs: 8, partials: [[2, 0.3]], rate });
        mixIn(bass, start + (bar * 4 + atBeat) * beat, pluck, gain);
      }
    }
  }

  // [bar, beat, note, velocity]. Only C-major pentatonic, so no melody note can clash with a
  // pad chord. The second half repeats the progression with a higher, sparser answer.
  const tune = [
    [0, 0, 'E5', 1], [0, 1, 'G5', 0.8], [0, 2, 'C6', 0.9], [0, 3, 'G5', 0.7],
    [1, 0, 'E5', 0.9], [1, 1.5, 'D5', 0.7], [1, 2, 'C5', 0.85],
    [2, 0, 'A4', 0.9], [2, 1, 'C5', 0.8], [2, 2, 'E5', 0.9], [2, 3, 'A5', 0.7],
    [3, 0, 'G5', 0.9], [3, 1.5, 'E5', 0.7], [3, 2.5, 'C5', 0.8],
    [4, 0, 'A4', 0.9], [4, 1, 'C5', 0.8], [4, 2, 'A5', 0.9], [4, 3, 'G5', 0.7],
    [5, 0, 'E5', 0.9], [5, 1.5, 'C5', 0.7], [5, 2.5, 'D5', 0.8],
    [6, 0, 'D5', 0.9], [6, 1, 'G5', 0.8], [6, 2, 'E5', 0.9], [6, 3, 'D5', 0.7],
    [7, 0, 'G4', 0.9], [7, 1, 'A4', 0.8], [7, 2, 'D5', 0.85],

    [8, 0, 'C6', 0.9], [8, 1.5, 'G5', 0.7], [8, 2.5, 'E5', 0.8],
    [9, 0, 'G5', 0.9], [9, 1, 'A5', 0.7], [9, 2, 'G5', 0.8], [9, 3, 'E5', 0.7],
    [10, 0, 'E5', 0.9], [10, 1.5, 'A5', 0.8], [10, 2.5, 'C6', 0.85],
    [11, 0, 'A5', 0.9], [11, 1, 'G5', 0.7], [11, 2, 'E5', 0.8], [11, 3, 'C5', 0.7],
    [12, 0, 'C6', 0.9], [12, 1, 'A5', 0.8], [12, 2, 'G5', 0.8], [12, 3, 'E5', 0.7],
    [13, 0, 'C5', 0.9], [13, 1.5, 'D5', 0.7], [13, 2.5, 'E5', 0.8],
    [14, 0, 'D5', 0.9], [14, 1, 'E5', 0.7], [14, 2, 'G5', 0.8], [14, 2.5, 'A5', 0.6], [14, 3, 'G5', 0.7],
    [15, 0, 'E5', 0.9], [15, 1, 'D5', 0.75], [15, 2, 'C5', 0.85],
  ];
  for (const [bar, atBeat, name, velocity] of tune) {
    // A kalimba-like pluck: a quick attack and a long, soft ring.
    const pluck = blip({
      from: note(name),
      durationMs: 1800,
      decay: 3.2,
      attackMs: 3,
      partials: [[2, 0.18], [3, 0.06]],
      rate,
    });
    mixIn(melody, Math.round((bar * 4 + atBeat) * beat), pluck, velocity);
  }

  // A dotted-eighth echo on the melody for a little space. The buffer is circular, so a few
  // passes let the echoes of the loop's end settle into its start.
  const delay = Math.round(beat * 0.75);
  const echoed = Float64Array.from(melody);
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < total; i++) echoed[i] = melody[i] + 0.35 * echoed[(i - delay + total) % total];
  }

  const mix = new Float64Array(total);
  for (let i = 0; i < total; i++) mix[i] = pads[i] * 0.2 + bass[i] * 0.3 + echoed[i] * 0.5;

  // Take the edge off the triangle partials. The first pass only warms the filter up, so the
  // state it carries into sample 0 is the loop's own end.
  const a = 1 - Math.exp((-2 * Math.PI * 4200) / rate);
  let low = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < total; i++) {
      low += a * (mix[i] - low);
      if (pass === 1) mix[i] = low;
    }
  }
  return mix;
}

// ---------------------------------------------------------------------------------------------

const sounds = {
  // Picking a token up: a quick rising bloop.
  lift: {
    peak: 0.55,
    samples: fadeOut(blip({ from: 380, to: 920, glideMs: 80, durationMs: 130, decay: 16, partials: [[2, 0.1]] })),
  },

  // A token landing: a falling boink over a tiny thud. It plays most, so it is kept short.
  place: {
    peak: 0.6,
    samples: fadeOut(
      sequence([
        { atMs: 0, samples: blip({ from: 760, to: 230, glideMs: 70, durationMs: 170, decay: 20, partials: [[2, 0.08]] }) },
        { atMs: 10, samples: blip({ from: 150, to: 95, glideMs: 60, durationMs: 100, decay: 40, gain: 0.5 }) },
      ]),
    ),
  },

  // A lane finished: three bubbles rising up a major triad, with a soft octave on top.
  complete: {
    peak: 0.75,
    samples: fadeOut(
      sequence([
        bubble(note('C6'), 0),
        bubble(note('E6'), 70),
        bubble(note('G6'), 140),
        bubble(note('C7'), 220, { durationMs: 320, gain: 0.6 }),
      ]),
    ),
  },

  // A refused move: a wobbly bonk. Comic, never harsh - the player made an honest mistake.
  invalid: {
    peak: 0.6,
    samples: fadeOut(
      blip({ from: 260, to: 120, glideMs: 140, durationMs: 240, decay: 13, shape: 'triangle', vibrato: 0.08, vibratoHz: 22 }),
    ),
  },

  // Board solved: a little fanfare with a sparkle on top.
  win: {
    peak: 0.82,
    samples: fadeOut(
      sequence([
        horn(note('C5'), 0, 300, 8),
        horn(note('E5'), 110, 300, 8),
        horn(note('G5'), 220, 300, 8),
        horn(note('C6'), 340, 900, 3.2),
        { atMs: 480, samples: bell(note('C7'), { durationMs: 400, gain: 0.25 }) },
        { atMs: 540, samples: bell(note('E7'), { durationMs: 400, gain: 0.22 }) },
        { atMs: 600, samples: bell(note('G7'), { durationMs: 500, gain: 0.2 }) },
      ]),
      30,
    ),
  },

  // Out of moves: a gentle "wah-wah" slide down. Sympathetic, and a little bit silly.
  stuck: {
    peak: 0.62,
    samples: fadeOut(
      sequence([
        {
          atMs: 0,
          samples: blip({ from: note('G4'), to: note('F#4'), glideMs: 320, durationMs: 380, decay: 2, attackMs: 25, shape: 'triangle', wah: true }),
        },
        {
          atMs: 400,
          samples: blip({
            from: note('F4'),
            to: note('C4'),
            glideMs: 700,
            durationMs: 800,
            decay: 1.8,
            attackMs: 25,
            shape: 'triangle',
            vibrato: 0.018,
            vibratoHz: 5.5,
            wah: true,
          }),
        },
      ]),
      40,
    ),
  },

  // A move taken back: the lift played in reverse, a falling whoop.
  undo: {
    peak: 0.55,
    samples: fadeOut(blip({ from: 950, to: 360, glideMs: 120, durationMs: 160, decay: 14, partials: [[2, 0.08]] })),
  },

  // The level starting over: the board swept clear, then a fresh blip.
  restart: {
    peak: 0.6,
    samples: fadeOut(
      sequence([
        { atMs: 0, samples: swoosh({ durationMs: 220 }) },
        { atMs: 170, samples: blip({ from: 520, to: 1040, glideMs: 60, durationMs: 160, decay: 18 }) },
      ]),
    ),
  },

  // Any button: the smallest, quietest sound in the set.
  tap: {
    peak: 0.4,
    samples: fadeOut(blip({ from: 1500, to: 1100, glideMs: 20, durationMs: 60, decay: 55, attackMs: 1 }), 4),
  },

  // One star stamping onto the win sheet. Pitched in the fanfare's key so the two can overlap.
  star: {
    peak: 0.6,
    samples: fadeOut(bell(note('G6')), 20),
  },

  // A hint appearing: a two-note sparkle, "look here".
  hint: {
    peak: 0.55,
    samples: fadeOut(
      sequence([
        { atMs: 0, samples: blip({ from: note('E6') * 0.9, to: note('E6'), glideMs: 20, durationMs: 200, decay: 18 }) },
        { atMs: 80, samples: blip({ from: note('B6') * 0.9, to: note('B6'), glideMs: 20, durationMs: 260, decay: 14 }) },
      ]),
    ),
  },

  // Background music. Quieter than the effects at the source, and turned down again in the app.
  music: { rate: MUSIC_RATE, peak: 0.7, samples: renderMusic() },
};

mkdirSync(outDir, { recursive: true });
for (const [name, { samples, rate = SFX_RATE, peak }] of Object.entries(sounds)) {
  const wav = encodeWav(samples, { rate, peak });
  writeFileSync(join(outDir, `${name}.wav`), wav);
  const ms = ((samples.length / rate) * 1000).toFixed(0);
  console.log(`  ${name.padEnd(9)} ${ms.padStart(6)}ms  ${(wav.length / 1024).toFixed(1).padStart(7)}KB`);
}
console.log(`\nWrote ${Object.keys(sounds).length} sounds to assets/sound`);
