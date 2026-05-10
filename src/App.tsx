import { useActiveAlarm } from './hooks/useActiveAlarm';
import Dashboard from './components/Dashboard';
import Countdown from './components/Countdown';
import SegmentCountdown from './components/SegmentCountdown';

export default function App() {
  const activeAlarm = useActiveAlarm();

  return (
    <div className="min-h-dvh bg-bg text-text-primary flex flex-col items-center">
      {activeAlarm.mode === 'idle'       && <Dashboard activeAlarm={activeAlarm} />}
      {activeAlarm.mode === 'continuous' && <Countdown alarm={activeAlarm.alarm} />}
      {activeAlarm.mode === 'segments'   && <SegmentCountdown alarm={activeAlarm.alarm} />}
      <p className="fixed bottom-3 right-4 text-text-secondary text-xs opacity-40">Version: 1.2</p>
    </div>
  );
}
