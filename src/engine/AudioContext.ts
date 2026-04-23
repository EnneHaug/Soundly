/**
 * Shared AudioContext singleton with autoplay guard.
 *
 * Must be called from a user gesture handler (click/tap). Calling from page load
 * results in a suspended context that won't play audio until user interaction.
 *
 * On iOS 17+ (feature-detected), sets navigator.audioSession.type = 'playback'
 * so the silent/ringer switch does not mute WebAudio output. No-op on iOS ≤16,
 * Firefox, Chrome desktop, and any other browser without the API.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/audioSession
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
    // iOS 17+ WebAudio silent-switch fix (WebKit bug 237322). D-01 per 05-CONTEXT.md.
    // No-op on iOS ≤16, Firefox, Chrome desktop, and any other browser without the API.
    if ('audioSession' in navigator) {
      (navigator as Navigator & { audioSession: { type: string } }).audioSession.type = 'playback';
    }
  }
  if (_ctx.state === 'suspended') {
    await _ctx.resume();
  }
  return _ctx;
}
