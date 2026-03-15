import { useState } from 'react';

interface DatasetConnectProps {
  onConnect: (path: string) => void;
  loading: boolean;
}

export default function DatasetConnect({ onConnect, loading }: DatasetConnectProps) {
  const [path, setPath] = useState('C:\\Users\\meime\\GenAIGenesis\\resized_dataset');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (path.trim()) onConnect(path.trim());
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-surface border border-border p-8 w-full max-w-lg space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-text mb-2">
            Load Your <span className="text-berry">Dataset</span>
          </h2>
          <p className="text-text-muted text-sm">
            Enter the path to your COCO-format dataset directory to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="dataset-path" className="block text-sm font-medium text-text mb-1">
              Dataset Directory
            </label>
            <div className="flex items-center border border-border bg-bg focus-within:border-kiwi">
              <span className="px-3 text-text-muted shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
              </span>
              <input
                id="dataset-path"
                type="text"
                value={path}
                onChange={e => setPath(e.target.value)}
                placeholder="\path\to\your\dataset"
                className="flex-1 px-2 py-3 bg-transparent text-text text-sm focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !path.trim()}
            className="w-full px-6 py-3 bg-berry text-white font-medium text-sm hover:bg-berry/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading...' : 'Load Dataset'}
          </button>
        </form>

        <div className="border border-border bg-bg p-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Expected Structure</p>
          <pre className="text-xs font-mono text-text-muted leading-relaxed">{`your_dataset/train/
├── _annotations.coco.json
└── *.jpg / *.png / *.webp`}</pre>
        </div>
      </div>
    </div>
  );
}
