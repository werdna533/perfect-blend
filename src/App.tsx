import { useState } from 'react';
import type {
  AppStep,
  DatasetMetadata,
  ParseResult,
  AnalysisResult,
  RebalanceTarget,
} from './types';
import { useApi } from './hooks/useApi';
import DatasetConnect from './components/DatasetConnect';
import BubbleChart from './components/BubbleChart';
import AnalysisPanel from './components/AnalysisPanel';
import RebalanceControls from './components/RebalanceControls';
import ProgressPanel from './components/ProgressPanel';

const STEPS: { key: AppStep; label: string }[] = [
  { key: 'connect', label: 'Load Dataset' },
  { key: 'visualize', label: 'Visualize' },
  { key: 'analyze', label: 'AI Analysis' },
  { key: 'rebalance', label: 'Rebalance' },
  { key: 'results', label: 'Results' },
];

export default function App() {
  const api = useApi();
  const [step, setStep] = useState<AppStep>('connect');
  const [metadata, setMetadata] = useState<DatasetMetadata | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [targets, setTargets] = useState<RebalanceTarget[]>([]);
  const [resultParseData, setResultParseData] = useState<ParseResult | null>(null);

  const stepIndex = STEPS.findIndex(s => s.key === step);

  const handleConnect = async (path: string) => {
    const meta = await api.connectDataset(path);
    setMetadata(meta);
    const parsed = await api.parseDataset('train');
    setParseResult(parsed);
    setStep('visualize');
  };

  const handleAnalyze = async (purpose: string) => {
    if (!parseResult) return;
    const result = await api.analyzeDataset(purpose, parseResult.distribution);
    setAnalysis(result);
    setTargets(
      result.classes.map(c => ({
        class_name: c.class_name,
        target_count: c.target_count,
        strategy: c.strategy,
      }))
    );
    setStep('analyze');
  };

  const handleStartRebalance = () => {
    setStep('rebalance');
  };

  const handleRebalanceComplete = async () => {
    const result = await api.parseDataset('balanced');
    setResultParseData(result);
    setStep('results');
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border bg-surface px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/blender-img.png"
              alt="PerfectBlend logo"
              className="w-8 h-8 object-contain"
            />
            <h1 className="text-xl font-bold text-text tracking-tight">
              Perfect<span className="text-berry">Blend</span>
            </h1>
          </div>
          <p className="text-sm text-text-muted">MLOps Dataset Balancing Tool</p>
        </div>
      </header>

      {/* Step Indicator */}
      <div className="border-b border-border bg-surface px-6 py-3">
        <div className="max-w-7xl mx-auto flex gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`flex-1 px-4 py-2 text-sm font-medium text-center transition-colors
                ${i <= stepIndex
                  ? 'bg-berry text-white'
                  : 'bg-border/50 text-text-muted'
                }`}
            >
              <span className="mr-2">{i + 1}.</span>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {api.error && (
          <div className="bg-strawberry/10 border border-strawberry text-strawberry px-4 py-3 mb-6 text-sm">
            {api.error}
            <button
              onClick={() => api.setError(null)}
              className="ml-4 font-bold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {step === 'connect' && (
          <DatasetConnect onConnect={handleConnect} loading={api.loading} />
        )}

        {step === 'visualize' && parseResult && (
          <div className="space-y-6">
            <BubbleChart
              data={parseResult.bubbles}
              categories={metadata?.categories || []}
              title="Current Dataset Distribution"
            />
            <div className="bg-surface border border-border p-6">
              <h3 className="text-lg font-bold mb-4">Analyze for Bias</h3>
              <p className="text-text-muted text-sm mb-4">
                Describe the purpose of finetuning your CV model. The AI will analyze whether your dataset composition
                is appropriate for your use case based on real-world domain knowledge.
              </p>
              <AnalyzeForm onSubmit={handleAnalyze} loading={api.loading} />
            </div>
          </div>
        )}

        {step === 'analyze' && analysis && parseResult && (
          <div className="space-y-6">
            <AnalysisPanel analysis={analysis} />
            <RebalanceControls
              classes={analysis.classes}
              targets={targets}
              onTargetsChange={setTargets}
              onApply={handleStartRebalance}
            />
          </div>
        )}

        {step === 'rebalance' && metadata && (
          <ProgressPanel
            targets={targets}
            datasetPath={metadata.path}
            onComplete={handleRebalanceComplete}
            api={api}
          />
        )}

        {step === 'results' && parseResult && resultParseData && metadata && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Before & After</h2>
            <div className="grid grid-cols-2 gap-6">
              <BubbleChart
                data={parseResult.bubbles}
                categories={metadata.categories}
                title="Original"
              />
              <BubbleChart
                data={resultParseData.bubbles}
                categories={metadata.categories}
                title="Balanced"
              />
            </div>
            <div className="bg-surface border border-border p-6 text-center">
              <h3 className="text-lg font-bold text-kiwi mb-2">Blending Complete!</h3>
              <p className="text-text-muted text-sm">
                Your balanced dataset has been exported. The original dataset is untouched.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function AnalyzeForm({ onSubmit, loading }: { onSubmit: (purpose: string) => void; loading: boolean }) {
  const [purpose, setPurpose] = useState('counting marine organisms from drop camera survey images around the Belcher islands to support fisheries and conservation efforts');
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        if (purpose.trim()) onSubmit(purpose.trim());
      }}
      className="flex gap-3"
    >
      <input
        type="text"
        value={purpose}
        onChange={e => setPurpose(e.target.value)}
        placeholder="e.g., Counting marine organisms for fisheries conservation on the Belcher Islands"
        className="flex-1 px-4 py-3 border border-border bg-bg text-text text-sm focus:outline-none focus:border-kiwi"
      />
      <button
        type="submit"
        disabled={loading || !purpose.trim()}
        className="px-6 py-3 bg-blueberry text-white font-medium text-sm hover:bg-blueberry/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <img src="/blender-gif.gif" alt="Loading" className="h-4 w-4 object-contain" />
            Analyzing...
          </span>
        ) : 'Analyze with AI'}
      </button>
    </form>
  );
}
