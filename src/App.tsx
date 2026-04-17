import { useAlarm } from './hooks/useAlarm';
import Dashboard from './components/Dashboard';

export default function App() {
  const alarm = useAlarm();
  const showCountdown = alarm.isRunning || alarm.phase !== 'idle';

  return (
    <div className="min-h-dvh bg-bg text-text-primary flex flex-col items-center">
      {showCountdown ? (
        <div className="p-8 text-center">
          <p className="text-2xl text-text-secondary">Alarm Active</p>
          <p className="mt-2">Phase: {alarm.phase}</p>
          <button
            onClick={alarm.stop}
            className="mt-4 px-6 py-3 bg-accent text-white rounded-xl"
          >
            Stop
          </button>
        </div>
      ) : (
        <Dashboard alarm={alarm} />
      )}
    </div>
  );
}
