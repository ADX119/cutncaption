import { type DeviceEnv, isIos, isMobile } from './platform';

/** L = low-end phone, M = mid phone/tablet (and all iOS), H = desktop or high-memory device. */
export type DeviceClass = 'L' | 'M' | 'H';

/**
 * Rules from docs/ARCHITECTURE.md §8. `deviceMemory` is quantised by the browser
 * (…, 2, 4, 8), so "≤ 3" in practice means a phone that reports 2 GB or less.
 */
export function classifyDevice(env: DeviceEnv): DeviceClass {
  const memory = env.deviceMemory;
  const cores = env.hardwareConcurrency;

  // iOS reports no memory and kills tabs early, whatever the hardware.
  if (isIos(env)) return 'M';

  if (isMobile(env)) {
    if (memory !== undefined && memory >= 8) return 'H';
    if ((memory !== undefined && memory <= 3) || (cores !== undefined && cores <= 4)) return 'L';
    return 'M';
  }

  // Desktop: high unless it reports very little memory (old laptops, small Chromebooks).
  if (memory !== undefined && memory <= 3) return 'M';
  return 'H';
}
