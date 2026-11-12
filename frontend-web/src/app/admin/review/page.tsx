'use client';

import React, { useState, useEffect } from 'react';
import { CheckSquare, Film, RefreshCw, Loader2, Database, Download, Terminal } from 'lucide-react';
import { api } from '@/lib/api';
import { VideoInspector } from '@/components/VideoInspector';
import { formatBytes } from '@/lib/utils';

export default function AdminReviewPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [approvedManifest, setApprovedManifest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [queueItems, manifest] = await Promise.all([
        api.getReviewQueue().catch((err) => {
          console.error('Queue load err:', err);
          return [];
        }),
        api.getApprovedDataset().catch(() => null),
      ]);

      setQueue(queueItems);
      setApprovedManifest(manifest);

      if (queueItems.length > 0 && !selectedSubmission) {
        setSelectedSubmission(queueItems[0]);
      } else if (queueItems.length === 0) {
        setSelectedSubmission(null);
      }
    } catch (err: any) {
      setError('Could not connect to FastAPI backend at http://localhost:8000');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-amber-400" />
            Quality Control & Review Station
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Human-in-the-loop inspection of automated QC-validated training videos.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Review Station Inspector */}
      {selectedSubmission ? (
        <VideoInspector
          submission={selectedSubmission}
          onDecisionSubmitted={() => {
            loadData();
          }}
        />
      ) : (
        <div className="p-12 text-center text-zinc-500 font-mono text-xs bg-zinc-900 border border-zinc-800 rounded-xl">
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              <span>Fetching review queue from PostgreSQL...</span>
            </div>
          ) : (
            'Review queue is currently empty. All submitted videos have been reviewed.'
          )}
        </div>
      )}

      {/* Queue Table */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
          Pending Ingestion Queue ({queue.length})
        </h2>

        {queue.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
            {queue.map((item) => (
              <div
                key={item.submission_id}
                onClick={() => setSelectedSubmission(item)}
                className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                  selectedSubmission?.submission_id === item.submission_id
                    ? 'bg-zinc-800/80 border-l-2 border-emerald-400'
                    : 'hover:bg-zinc-850'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Film className="w-4 h-4 text-zinc-500 shrink-0" />
                  <div>
                    <span className="font-semibold text-zinc-200">{item.file_name}</span>
                    <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                      Task: {item.task_title || 'Workspace'} • {formatBytes(item.file_size_bytes || 0)} • {item.duration_seconds || 0}s
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="text-zinc-500">{item.worker_email || item.worker_id}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800">
                    QC PASS
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dataset Manifest & Local AI Sync Section */}
      {approvedManifest && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
                Approved Dataset Manifest (Ready for AI Training)
              </h3>
            </div>
            <span className="text-xs font-mono text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
              {approvedManifest.total_approved_videos} Videos ({formatBytes(approvedManifest.total_size_bytes || 0)})
            </span>
          </div>

          <p className="text-xs text-zinc-400">
            Approved videos are marked eligible for local GPU ingest. Run this command on your AI training machine to pull them:
          </p>

          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono text-xs text-emerald-400 flex items-center justify-between">
            <code>python3 scripts/local_ai_sync.py --server http://localhost:8000 --dest ./local_training_data</code>
          </div>
        </div>
      )}
    </div>
  );
}
