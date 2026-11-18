/**
 * One-tap targets for "compress to size". Checked November 2026:
 *
 * - WhatsApp: 16 MB is the long-standing limit for sending a video as media and
 *   works on every version. Some sources report larger, connection-dependent limits
 *   now (up to ~100 MB); unconfirmed by WhatsApp, so the safe value stays.
 * - Discord: free accounts can upload 20 MB per file since 14 August 2026
 *   (Discord File Attachments FAQ; it was 10 MB before).
 * - Email: Gmail's 25 MB limit counts the attachment after Base64 encoding, which
 *   adds about a third, so files above roughly 18 MB fail.
 *
 * Services differ on whether "MB" means 1,000,000 or 1,048,576 bytes, so each
 * target is set 3% under the decimal value: safe under either reading.
 */
export const SIZE_PRESETS = {
  whatsapp: { labelMb: 16 },
  discord: { labelMb: 20 },
  email: { labelMb: 18 },
} as const;

export type SizePresetId = keyof typeof SIZE_PRESETS;

const SAFETY = 0.97;

/** The byte target for a preset. */
export function presetTargetBytes(id: SizePresetId): number {
  return Math.floor(SIZE_PRESETS[id].labelMb * 1_000_000 * SAFETY);
}

/** The byte target for a size the person typed, in MB. Null when it is not a size. */
export function customTargetBytes(text: string): number | null {
  const mb = Number(text.trim().replace(',', '.'));
  if (!Number.isFinite(mb) || mb <= 0 || mb > 100_000) return null;
  return Math.floor(mb * 1_000_000 * SAFETY);
}
