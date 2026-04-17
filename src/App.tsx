import { useAlarm } from './hooks/useAlarm';

export default function App() {
  const alarm = useAlarm();
  const showCountdown = alarm.isRunning || alarm.phase !== 'idle';

  return (
    <div className="min-h-dvh bg-bg text-text-primary flex flex-col items-center">
      {showCountdown ? (
        <div className="p-8 text-center">
          <p className="text-2xl">Countdown Screen (Plan 02)</p>
          <p>Phase: {alarm.phase}</p>
          <button onClick={alarm.stop} className="mt-4 px-6 py-3 bg-accent text-white rounded-xl">Stop</button>
        </div>
      ) : (
        <div className="p-8 text-center">
          <h1 className="text-3xl font-semibold text-sage mb-8">Soundly</h1>
          <p className="text-text-secondary">Dashboard (Plan 02)</p>
        </div>
      )}
    </div>
  );
}
