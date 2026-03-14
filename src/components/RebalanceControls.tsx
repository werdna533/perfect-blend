import { useState, useMemo } from 'react';
import type { ClassAnalysis, RebalanceTarget } from '../types';

interface RebalanceControlsProps {
  classes: ClassAnalysis[];
  targets: RebalanceTarget[];
  onTargetsChange: (targets: RebalanceTarget[]) => void;
  onApply: () => void;
}

export default function RebalanceControls({
  classes,
  targets,
  onTargetsChange,
  onApply,
}: RebalanceControlsProps) {
  const [confirmed, setConfirmed] = useState(false);

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
      <h3 className="text-lg font-bold text-text">Rebalance Controls</h3>
      <p className="text-sm text-text-muted">
        Review and adjust the target counts for each class. The strategy badge updates automatically.
      </p>

      {/* Class rows */}
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_100px_120px_90px] gap-3 text-xs font-medium text-text-muted px-1">
          <span>Class</span>
          <span className="text-right">Current</span>
          <span className="text-right">Target</span>
          <span className="text-center">Strategy</span>
        </div>

        {targets.map(target => {
          const current = currentByClass.get(target.class_name) || 0;
          return (
            <div
              key={target.class_name}
              className="grid grid-cols-[1fr_100px_120px_90px] gap-3 items-center border border-border/50 px-3 py-2"
            >
              <span className="text-sm font-medium text-text truncate">
                {target.class_name}
              </span>
              <span className="text-sm text-text-muted text-right tabular-nums">
                {current.toLocaleString()}
              </span>
              <input
                type="number"
                min={0}
                value={target.target_count}
                onChange={e => handleTargetChange(target.class_name, Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-2 py-1 text-sm text-right tabular-nums border border-border bg-bg text-text focus:outline-none focus:border-kiwi"
              />
              <div className="text-center">
                <StrategyBadge strategy={target.strategy} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Before/After bar chart */}
      <div>
        <h4 className="text-sm font-semibold text-text-muted mb-3">Before / After Comparison</h4>
        <div className="space-y-2">
          {targets.map(target => {
            const current = currentByClass.get(target.class_name) || 0;
            const currentPct = (current / maxCount) * 100;
            const targetPct = (target.target_count / maxCount) * 100;
            return (
              <div key={target.class_name} className="flex items-center gap-3">
                <span className="w-28 text-xs text-text-muted truncate shrink-0">
                  {target.class_name}
                </span>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-4 bg-bg">
                      <div
                        className="h-full bg-border transition-all"
                        style={{ width: `${currentPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-text-muted tabular-nums w-12 text-right">
                      {current}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-4 bg-bg">
                      <div
                        className={`h-full transition-all ${
                          target.strategy === 'upsample'
                            ? 'bg-kiwi'
                            : target.strategy === 'downsample'
                              ? 'bg-strawberry'
                              : 'bg-text-muted'
                        }`}
                        style={{ width: `${targetPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-text tabular-nums w-12 text-right font-medium">
                      {target.target_count}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-border" /> Current
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-kiwi" /> Upsample
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-strawberry" /> Downsample
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-text-muted" /> Keep
          </span>
        </div>
      </div>

      {/* Confirmation and apply */}
      <div className="border-t border-border pt-4 space-y-3">
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
          onClick={onApply}
          disabled={!confirmed}
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
