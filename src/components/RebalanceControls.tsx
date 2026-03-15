import { useState, useMemo } from 'react';
import type { ClassAnalysis, RebalanceTarget } from '../types';

interface RebalanceControlsProps {
  classes: ClassAnalysis[];
  targets: RebalanceTarget[];
  onTargetsChange: (targets: RebalanceTarget[]) => void;
  onApply: (outputName: string) => void;
}

export default function RebalanceControls({
  classes,
  targets,
  onTargetsChange,
  onApply,
}: RebalanceControlsProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [outputName, setOutputName] = useState('balanced_dataset');

  const rationaleByClass = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach(c => map.set(c.class_name, c.rationale));
    return map;
  }, [classes]);

  const currentByClass = useMemo(() => {
    const map = new Map<string, number>();
    classes.forEach(c => map.set(c.class_name, c.current_count));
    return map;
  }, [classes]);

  const handleTargetChange = (className: string, value: number) => {
    const current = currentByClass.get(className) || 0;
    const newTargets = targets.map(t => {
      if (t.class_name !== className) return t;
      let strategy: 'upsample' | 'downsample' | 'keep' = 'keep';
      if (value > current) strategy = 'upsample';
      else if (value < current) strategy = 'downsample';
      return { ...t, target_count: value, strategy };
    });
    onTargetsChange(newTargets);
  };

  const maxCount = useMemo(() => {
    let max = 0;
    classes.forEach(c => { if (c.current_count > max) max = c.current_count; });
    targets.forEach(t => { if (t.target_count > max) max = t.target_count; });
    return max || 1;
  }, [classes, targets]);

  return (
    <div className="bg-surface border border-border p-6 space-y-6">
      <div>
        <h3 className="text-lg font-bold text-text">Per-Class Targets</h3>
        <p className="text-sm text-text-muted mt-1">
          Review the AI's rationale and adjust target counts as needed. Strategy updates automatically.
        </p>
      </div>

      {/* Per-class cards */}
      <div className="space-y-4">
        {targets.map(target => {
          const current = currentByClass.get(target.class_name) || 0;
          const rationale = rationaleByClass.get(target.class_name) || '';
          const currentPct = (current / maxCount) * 100;
          const targetPct = (target.target_count / maxCount) * 100;
          const barColor =
            target.strategy === 'upsample'
              ? 'bg-kiwi'
              : target.strategy === 'downsample'
                ? 'bg-strawberry'
                : 'bg-text-muted';

          return (
            <div key={target.class_name} className="border border-border/60 p-4 space-y-3">
              {/* Header row: class name + strategy badge */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-text">{target.class_name}</span>
                <StrategyBadge strategy={target.strategy} />
              </div>

              {/* Current count | Target input | % change */}
              <div className="flex items-center gap-6">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-text-muted">Current</span>
                  <span className="text-lg font-bold tabular-nums text-text">
                    {current.toLocaleString()}
                  </span>
                </div>
                <div className="text-text-muted text-lg">→</div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-text-muted">Target</span>
                  <input
                    type="number"
                    min={0}
                    value={target.target_count}
                    onChange={e =>
                      handleTargetChange(target.class_name, Math.max(0, parseInt(e.target.value) || 0))
                    }
                    className="w-28 px-2 py-1 text-lg font-bold tabular-nums border border-border bg-bg text-text focus:outline-none focus:border-kiwi"
                  />
                </div>
                {current > 0 && target.target_count !== current && (() => {
                  const pct = Math.round(((target.target_count - current) / current) * 100);
                  const color = pct > 0 ? 'text-kiwi' : 'text-strawberry';
                  return (
                    <span className={`text-sm font-semibold tabular-nums ${color}`}>
                      {pct > 0 ? '+' : ''}{pct}%
                    </span>
                  );
                })()}
              </div>

              {/* AI Rationale */}
              {rationale && (
                <p className="text-xs text-text-muted italic leading-relaxed">{rationale}</p>
              )}

              {/* Before / After bars */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-14 text-xs text-text-muted shrink-0">Before</span>
                  <div className="flex-1 h-3 bg-bg">
                    <div className="h-full bg-border transition-all" style={{ width: `${currentPct}%` }} />
                  </div>
                  <span className="text-xs text-text-muted tabular-nums w-12 text-right">{current}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 text-xs text-text-muted shrink-0">After</span>
                  <div className="flex-1 h-3 bg-bg">
                    <div className={`h-full transition-all ${barColor}`} style={{ width: `${targetPct}%` }} />
                  </div>
                  <span className="text-xs text-text tabular-nums w-12 text-right font-medium">{target.target_count}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation and apply */}
      <div className="border-t border-border pt-4 space-y-3">
        <div>
          <label htmlFor="output-name" className="block text-sm font-medium text-text mb-1">
            Output Dataset Name
          </label>
          <input
            id="output-name"
            type="text"
            value={outputName}
            onChange={e => setOutputName(e.target.value.replace(/[^\w\-]/g, '_'))}
            className="w-64 px-3 py-2 border border-border bg-bg text-text text-sm font-mono focus:outline-none focus:border-kiwi"
          />
          <p className="text-xs text-text-muted mt-1">Saved as a sibling folder next to your dataset.</p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="w-4 h-4 accent-berry"
          />
          <span className="text-sm text-text">
            I have reviewed the AI's suggestions and adjusted targets as needed
          </span>
        </label>

        <button
          onClick={() => onApply(outputName.trim() || 'balanced_dataset')}
          disabled={!confirmed || !outputName.trim()}
          className="px-6 py-3 bg-berry text-white font-medium text-sm hover:bg-berry/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Start Blending
        </button>
      </div>
    </div>
  );
}

function StrategyBadge({ strategy }: { strategy: 'upsample' | 'downsample' | 'keep' }) {
  const styles: Record<string, string> = {
    upsample: 'bg-kiwi/15 text-kiwi border-kiwi',
    downsample: 'bg-strawberry/15 text-strawberry border-strawberry',
    keep: 'bg-border/30 text-text-muted border-border',
  };

  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium border ${styles[strategy]}`}>
      {strategy}
    </span>
  );
}
