import { useState, useEffect } from 'react';
import { useActiveAlarm } from './hooks/useActiveAlarm';
import { useHashComposition } from './hooks/useHashComposition';
import { WAKE_EASY_CONFIG, type SegmentConfig } from './engine';
import Dashboard from './components/Dashboard';
import Countdown from './components/Countdown';
import SegmentCountdown from './components/SegmentCountdown';
import Composer from './components/Composer';
import Toast from './components/Toast';

export default function App() {
  const activeAlarm = useActiveAlarm();
  const hash = useHashComposition();
  const [composerOpen, setComposerOpen] = useState(hash.composition !== null);
  // Tracks the most recently composed config so Stop returns the user to the Composer
  // with their composition preserved (not Wake Easy default). Updated when Composer.onStart
  // fires; reset to Wake Easy when the user taps Cancel (discard intent — see onClose).
  const [initialConfig, setInitialConfig] = useState<SegmentConfig>(
    hash.composition ?? WAKE_EASY_CONFIG,
  );
  const [toast, setToast] = useState<{ msg: string; ms: number } | null>(null);

  // Surface decode error once via toast (D-18 LOCKED — "Couldn't load shared
  // alarm — using default"). The effect's deps include `hash` because the
  // captured clearError reference flows from the same object; the effect is
  // idempotent (clearError flips error to null so re-renders see null and skip).
  useEffect(() => {
    if (hash.error !== null) {
      setToast({ msg: "Couldn't load shared alarm — using default", ms: 4000 });
      hash.clearError();
    }
  }, [hash.error, hash]);

  return (
    <div className="min-h-dvh bg-bg text-text-primary flex flex-col items-center">
      {activeAlarm.mode === 'idle' && (
        <>
          <Dashboard
            activeAlarm={activeAlarm}
            onCustomClick={() => setComposerOpen(true)}
          />
          <Composer
            open={composerOpen}
            initialConfig={initialConfig}
            onClose={() => {
              // Cancel discards the composition — next "+ Custom" tap starts fresh
              // from Wake Easy. Start → Stop still preserves (see onStart below).
              setComposerOpen(false);
              setInitialConfig(WAKE_EASY_CONFIG);
            }}
            onStart={async (cfg) => {
              // Remember the composed config + keep composerOpen=true so when the alarm
              // is stopped, the {mode === 'idle' && <Composer/>} conditional re-mounts the
              // Composer with this config pre-loaded — small-tweak-then-restart flow.
              setInitialConfig(cfg);
              await activeAlarm.start({ kind: 'segments', config: cfg });
            }}
            onShareSuccess={(msg) => setToast({ msg, ms: 3000 })}
            onShareError={(msg) => setToast({ msg, ms: 4000 })}
          />
        </>
      )}
      {activeAlarm.mode === 'continuous' && <Countdown alarm={activeAlarm.alarm} />}
      {activeAlarm.mode === 'segments'   && <SegmentCountdown alarm={activeAlarm.alarm} />}

      <Toast
        message={toast?.msg ?? null}
        durationMs={toast?.ms ?? 0}
        onDismiss={() => setToast(null)}
      />

      <p className="fixed bottom-3 right-4 text-text-secondary text-xs opacity-40">Version: 1.3</p>
    </div>
  );
}
