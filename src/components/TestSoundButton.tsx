/**
 * TestSoundButton — plays the singing bowl at mid-range volume (D-13).
 *
 * Must be triggered from a user gesture so AudioContext can be created/resumed.
 * Wrapped in try/catch in case the browser blocks AudioContext initialization.
 */

import { playTestSound } from '../engine';

export default function TestSoundButton() {
  const handleClick = () => {
    try {
      playTestSound();
    } catch {
      // AudioContext may fail if browser policy blocks it — fail silently
    }
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      className="text-text-secondary text-sm underline underline-offset-4 decoration-border hover:text-text-primary transition-colors"
    >
      Test Sound
    </button>
  );
}
