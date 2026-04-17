/**
 * Format milliseconds as mm:ss with zero-padding.
 * Returns "00:00" for values <= 0.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string like "05:30"
 */
export function formatMmSs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
