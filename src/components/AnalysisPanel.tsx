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

    </div>
  );
}
