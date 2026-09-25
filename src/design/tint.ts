/**
 * Mixing a chapter's accent into the felt.
 *
 * Twenty chapters shared one charcoal, so Brook and Bedrock were the same room with
 * different labels. The rule that pieces are the only saturated objects on screen is worth
 * keeping - colour is the mechanic - so this does not paint any chrome. It shifts the
 * board itself a few percent toward the chapter's hue: enough that Spring reads warm and
 * Deep reads cold, far too little to compete with a token.
 *
 * Plain arithmetic in its own file, so the whole treatment is one function to read and can
 * be tested without a renderer.
 */

/** A chapter accent that will not parse tints nothing, exactly as an out-of-range one does. */
function channels(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1]!, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function pair(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0');
}

/**
 * `base` moved `amount` of the way toward `accent`, as a #rrggbb string.
 *
 * Returns `base` unchanged for anything it cannot parse, so a malformed accent quietly
 * leaves the felt alone rather than throwing behind a board someone is playing.
 */
export function tintedSurface(base: string, accent: string, amount: number): string {
  const from = channels(base);
  const to = channels(accent);
  if (!from || !to) return base;

  const t = Math.min(1, Math.max(0, amount));
  const mixed = from.map((c, i) => c + (to[i]! - c) * t);
  return `#${mixed.map(pair).join('')}`;
}

