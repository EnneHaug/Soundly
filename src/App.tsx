import { useAlarm } from './hooks/useAlarm';
import Dashboard from './components/Dashboard';
import Countdown from './components/Countdown';

export default function App() {
  const alarm = useAlarm();
  const showCountdown = alarm.isRunning || alarm.phase !== 'idle';

  return (
    <div className="min-h-dvh bg-bg text-text-primary flex flex-col items-center">
      {showCountdown ? (
        <Countdown alarm={alarm} />
      ) : (
        <Dashboard alarm={alarm} />
      )}
    </div>
  );
}
