import { useState, useEffect, useRef } from 'react';
import { SegmentEngine } from '../engine/SegmentEngine';
import { WAKE_EASY_CONFIG, type SegmentChangeEvent } from '../engine/SegmentState';

interface LogRow {
  t: number; // performance.now() timestamp (ms)
  kind: 'start' | 'end';
  segmentIndex: number;
  segmentId: string;
}

/**
 * Phase 7 dev-only harness — verifies the SEG-02 <2 s drift requirement on
 * foreground desktop + Android in real browser conditions.
 *
 * Mounted by App.tsx ONLY when:
 *   import.meta.env.DEV && URL has ?dev=segments
 *
 * Vite tree-shakes the import + branch in production builds (verified via
 * `npm run build && grep -c SegmentHarness dist/assets/*.js` returning 0).
 *
 * Phase 8 removes this file + the App.tsx mount line when SegmentCountdown
 * ships as the production segment-mode UI.
 */
export default function SegmentHarness() {
  const engineRef = useRef<SegmentEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new SegmentEngine();
  }
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [stateLabel, setStateLabel] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const engine = engineRef.current!;
    engine.onSegmentChange((e: SegmentChangeEvent) => {
      setLogs((prev) => [
        ...prev,
        {
          t: performance.now(),
          kind: e.kind,
          segmentIndex: e.segmentIndex,
          segmentId: e.segment.id,
        },
      ]);
      setStateLabel(engine.getState());
    });

    return () => {
      // On unmount, ensure the AlarmSession + Wake Lock + audio nodes are released.
      engine.stop();
    };
  }, []);

  const handleStart = async () => {
    setError(null);
    try {
      await engineRef.current!.start(WAKE_EASY_CONFIG);
      setStateLabel(engineRef.current!.getState());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handlePause = () => {
    engineRef.current!.pause();
    setStateLabel(`${engineRef.current!.getState()} (paused=${engineRef.current!.isPaused()})`);
  };

  const handleResume = () => {
    engineRef.current!.resume();
    setStateLabel(engineRef.current!.getState());
  };

  const handleStop = () => {
    engineRef.current!.stop();
    setStateLabel(engineRef.current!.getState());
  };

  const handleClearLog = () => setLogs([]);

  return (
    <div className="min-h-dvh w-full max-w-3xl px-6 py-8 bg-bg text-text-primary">
      <h1 className="text-2xl mb-2">Segment Engine Harness</h1>
      <p className="text-sm text-text-secondary mb-6">
        Phase 7 dev-only — drives <code>WAKE_EASY_CONFIG</code> through the SegmentEngine and logs every
        <code> onSegmentChange</code> event with <code>performance.now()</code> timestamps. Use this to verify
        SEG-02 (&lt;2&nbsp;s drift over 17&nbsp;min) on foreground desktop + Android.
      </p>

      <div className="flex gap-3 mb-4 flex-wrap">
        <button
          onClick={handleStart}
          className="px-6 py-2 rounded-xl bg-accent text-white text-sm transition-colors hover:bg-accent/90 active:scale-[0.98]"
        >
          Start
        </button>
        <button
          onClick={handlePause}
          className="px-6 py-2 rounded-xl border border-border text-text-primary bg-white/60 text-sm transition-colors hover:bg-white/80 active:scale-[0.98]"
        >
          Pause
        </button>
        <button
          onClick={handleResume}
          className="px-6 py-2 rounded-xl border border-border text-text-primary bg-white/60 text-sm transition-colors hover:bg-white/80 active:scale-[0.98]"
        >
          Resume
        </button>
        <button
          onClick={handleStop}
          className="px-6 py-2 rounded-xl border border-border text-text-primary bg-white/60 text-sm transition-colors hover:bg-white/80 active:scale-[0.98]"
        >
          Stop
        </button>
        <button
          onClick={handleClearLog}
          className="px-6 py-2 rounded-xl border border-border text-text-secondary bg-white/40 text-sm transition-colors hover:bg-white/60 active:scale-[0.98]"
        >
          Clear log
        </button>
      </div>

      <div className="mb-4 text-sm">
        <span className="text-text-secondary">State: </span>
        <code className="text-text-primary">{stateLabel}</code>
        {error && (
          <p className="mt-2 text-sm text-red-600">Error: {error}</p>
        )}
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead className="bg-white/40 text-text-secondary">
            <tr>
              <th className="text-left px-3 py-2">t (ms)</th>
              <th className="text-left px-3 py-2">kind</th>
              <th className="text-left px-3 py-2">idx</th>
              <th className="text-left px-3 py-2">segment id</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-text-secondary">
                  No events yet. Click Start to begin.
                </td>
              </tr>
            ) : (
              logs.map((row, i) => (
                <tr key={i} className="border-t border-border/50">
                  <td className="px-3 py-1.5">{row.t.toFixed(2)}</td>
                  <td className="px-3 py-1.5">{row.kind}</td>
                  <td className="px-3 py-1.5">{row.segmentIndex}</td>
                  <td className="px-3 py-1.5">{row.segmentId}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
