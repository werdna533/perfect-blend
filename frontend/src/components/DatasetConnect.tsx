import { useState } from 'react';

interface DatasetConnectProps {
  onConnect: (path: string) => void;
  loading: boolean;
}

export default function DatasetConnect({ onConnect, loading }: DatasetConnectProps) {
  const [path, setPath] = useState('');

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
              className="w-full px-4 py-3 border border-border bg-bg text-text text-sm focus:outline-none focus:border-berry"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !path.trim()}
            className="w-full px-6 py-3 bg-berry text-white font-medium text-sm hover:bg-berry/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Loading...
              </span>
            ) : (
              'Load Dataset'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
