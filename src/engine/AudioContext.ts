/**
 * Shared AudioContext singleton with autoplay guard.
 *
 * Must be called from a user gesture handler (click/tap). Calling from page load
 * results in a suspended context that won't play audio until user interaction.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
 */

let _ctx: AudioContext | null = null;

/**
 * Returns the shared AudioContext, creating or resuming it as needed.
 *
 * Must be called from a user gesture handler (click/tap). Calling from page load
 * results in a suspended context that won't play audio until user interaction.
 */
export async function getAudioContext(): Promise<AudioContext> {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new AudioContext();
  }
  if (_ctx.state === 'suspended') {
    await _ctx.resume();
  }
  return _ctx;
}
