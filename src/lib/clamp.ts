/** Clamps `value` into [min, max]. NaN falls back to `min` so UI maths never propagates NaN. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) throw new RangeError(`clamp: min ${min} is greater than max ${max}`);
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}
