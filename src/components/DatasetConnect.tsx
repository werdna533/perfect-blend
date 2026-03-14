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
      <div className="bg-surface border border-border p-8 w-full max-w-lg">
        <h2 className="text-2xl font-bold text-text mb-2">
          Load Your <span className="text-berry">Dataset</span>
        </h2>
        <p className="text-text-muted text-sm mb-6">
          Enter the path to your COCO-format dataset directory to get started.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="dataset-path" className="block text-sm font-medium text-text mb-1">
              Dataset Directory
            </label>
            <input
              id="dataset-path"
              type="text"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="/path/to/your/dataset"
              className="w-full px-4 py-3 border border-border bg-bg text-text text-sm focus:outline-none focus:border-kiwi"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !path.trim()}
            className="w-full px-6 py-3 bg-berry text-white font-medium text-sm hover:bg-berry/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading...' : 'Load Dataset'}
          </button>
        </form>
      </div>
    </div>
  );
}
