import { useState, useEffect, useRef } from 'react';
import type { RebalanceTarget, RebalanceProgress } from '../types';

interface ProgressPanelProps {
  targets: RebalanceTarget[];
  datasetPath: string;
  onComplete: () => void;
  api: {
    rebalanceDataset: (
      targets: RebalanceTarget[],
      outputPath: string,
      onProgress: (data: RebalanceProgress) => void
    ) => Promise<void>;
    loading: boolean;
    error: string | null;
  };
}

export default function ProgressPanel({
  targets,
  datasetPath,
  onComplete,
  api,
}: ProgressPanelProps) {
  const [progress, setProgress] = useState<RebalanceProgress | null>(null);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  // Derive output path from dataset path
  const outputPath = (() => {
    const normalized = datasetPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const lastSlash = normalized.lastIndexOf('/');
    const parent = lastSlash >= 0 ? normalized.slice(0, lastSlash) : '.';
    return `${parent}/balanced_dataset`;
  })();

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    api
      .rebalanceDataset(targets, outputPath, (data: RebalanceProgress) => {
        setProgress(data);
      })
      .then(() => {
        setDone(true);
      })
      .catch(() => {
        // Error is handled by the api hook (api.error)
      });
  }, []);

  const progressPct =
    progress && progress.total > 0
      ? Math.round((progress.progress / progress.total) * 100)
      : 0;

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="bg-surface border border-border p-8 w-full max-w-lg text-center space-y-6">
        {!done ? (
          <>
            <div>
              <h2 className="text-2xl font-bold text-text mb-1">
                Blending in progress...
              </h2>
              <p className="text-sm text-text-muted">
                Your dataset is being rebalanced. This may take a moment.
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="w-full h-6 bg-bg border border-border overflow-hidden">
                <div
                  className="h-full bg-berry transition-all duration-300 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-text-muted">
                <span>{progress?.step || 'Initializing...'}</span>
                <span>{progressPct}%</span>
              </div>
            </div>

            {/* Status message */}
            {progress?.message && (
              <p className="text-sm text-text-muted">{progress.message}</p>
            )}

            {/* Output path info */}
            <p className="text-xs text-text-muted">
              Output: <span className="font-mono text-text">{outputPath}</span>
            </p>
          </>
        ) : (
          <>
            <div>
              <div className="w-16 h-16 bg-kiwi/15 border border-kiwi flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-kiwi"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="square" strokeLinejoin="miter" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-kiwi mb-1">Blending Complete!</h2>
              <p className="text-sm text-text-muted">
                Your balanced dataset has been exported to:
              </p>
              <p className="text-sm font-mono text-text mt-1">{outputPath}</p>
            </div>

            <button
              onClick={onComplete}
              className="px-6 py-3 bg-berry text-white font-medium text-sm hover:bg-berry/90 transition-colors"
            >
              View Results
            </button>
          </>
        )}

        {api.error && (
          <div className="bg-strawberry/10 border border-strawberry text-strawberry px-4 py-3 text-sm text-left">
            {api.error}
          </div>
        )}
      </div>
    </div>
  );
}
