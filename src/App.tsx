import { useAlarm } from './hooks/useAlarm';
import Dashboard from './components/Dashboard';
import Countdown from './components/Countdown';
import SegmentHarness from './dev/SegmentHarness';

export default function App() {
  const alarm = useAlarm();
  const showCountdown = alarm.isRunning || alarm.phase !== 'idle';
  const showSegmentHarness =
    import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('dev') === 'segments';

  return (
    <div className="min-h-dvh bg-bg text-text-primary flex flex-col items-center">
      {showSegmentHarness ? (
        <SegmentHarness />
      ) : showCountdown ? (
        <Countdown alarm={alarm} />
      ) : (
        <Dashboard alarm={alarm} />
      )}
      <p className="fixed bottom-3 right-4 text-text-secondary text-xs opacity-40">Version: 1.1</p>
    </div>
  );
}
