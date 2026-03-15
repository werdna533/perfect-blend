import { useState, useCallback } from 'react';
import type {
  DatasetMetadata,
  ParseResult,
  AnalysisResult,
} from '../types';

const API = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectDataset = useCallback(async (path: string): Promise<DatasetMetadata> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<DatasetMetadata>(`${API}/dataset/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      return result;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const parseDataset = useCallback(async (split: string, outputPath?: string): Promise<ParseResult> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ split });
      if (outputPath) params.set('output_dir', outputPath);
      const result = await fetchJson<ParseResult>(`${API}/dataset/parse?${params}`);
      return result;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeDataset = useCallback(async (purpose: string, distribution: any[]): Promise<AnalysisResult> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<AnalysisResult>(`${API}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, distribution }),
      });
      return result;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const rebalanceDataset = useCallback(async (
    targets: any[],
    outputPath: string,
    onProgress: (data: any) => void
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/rebalance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets, output_path: outputPath }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Rebalance failed');
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          const lines = text.split('\n').filter(l => l.startsWith('data: '));
          for (const line of lines) {
            try {
              const data = JSON.parse(line.slice(6));
              onProgress(data);
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, setError, connectDataset, parseDataset, analyzeDataset, rebalanceDataset };
}
