import type { AnalysisResult } from '../types';

interface AnalysisPanelProps {
  analysis: AnalysisResult;
}

export default function AnalysisPanel({ analysis }: AnalysisPanelProps) {
  return (
    <div className="bg-surface border border-border p-6 space-y-6">
      <h3 className="text-lg font-bold text-text">AI Analysis</h3>

      {/* Strategy blurb */}
      <div className="bg-blueberry/10 border border-blueberry p-4">
        <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
          {analysis.analysis}
        </p>
      </div>

      {/* Citations */}
      {analysis.citations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-text-muted mb-2">Sources</h4>
          <ul className="space-y-1">
            {analysis.citations.map((citation, i) => (
              <li key={i} className="text-sm text-text-muted">
                <span className="text-text-muted mr-1">[{i + 1}]</span>
                {citation.url ? (
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blueberry hover:underline"
                  >
                    {citation.text}
                  </a>
                ) : (
                  <span>{citation.text}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Class analysis table */}
      <div>
        <h4 className="text-sm font-semibold text-text-muted mb-3">Per-Class Breakdown</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-text-muted font-medium">Class</th>
                <th className="text-right py-2 px-3 text-text-muted font-medium">Current</th>
                <th className="text-right py-2 px-3 text-text-muted font-medium">Target</th>
                <th className="text-center py-2 px-3 text-text-muted font-medium">Strategy</th>
                <th className="text-left py-2 px-3 text-text-muted font-medium">Rationale</th>
              </tr>
            </thead>
            <tbody>
              {analysis.classes.map(cls => (
                <tr key={cls.class_name} className="border-b border-border/50 hover:bg-bg/50">
                  <td className="py-2 px-3 font-medium text-text">{cls.class_name}</td>
                  <td className="py-2 px-3 text-right text-text tabular-nums">
                    {cls.current_count.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right text-text tabular-nums">
                    {cls.target_count.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <StrategyBadge strategy={cls.strategy} />
                  </td>
                  <td className="py-2 px-3 text-text-muted text-xs">{cls.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
