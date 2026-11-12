'use client';

import React, { useState, useEffect } from 'react';
import { CheckSquare, Film, RefreshCw, Loader2, Database, Download, Terminal, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { VideoInspector } from '@/components/VideoInspector';
import { formatBytes } from '@/lib/utils';

export default function AdminReviewPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [approvedManifest, setApprovedManifest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [queueItems, manifest] = await Promise.all([
        api.getReviewQueue().catch(() => []),
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
      console.error('Queue load failed:', err);
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
      <div className="flex items-center justify-between pb-3.5 border-b border-zinc-800/80">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-amber-400" />
            Quality Control & Review Station
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Human-in-the-loop review of automated QC-validated training videos.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg transition-colors btn-press"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {/* Review Station Inspector */}
      {selectedSubmission ? (
        <VideoInspector
          submission={selectedSubmission}
          onDecisionSubmitted={() => {
            loadData();
          }}
        />
      ) : (
        <div className="p-12 text-center text-zinc-500 font-mono text-xs bg-[#0f1422] border border-zinc-800/80 rounded-xl">
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              <span>Fetching review queue...</span>
            </div>
          ) : (
            'Review queue is currently empty. All submitted videos have been reviewed.'
          )}
        </div>
      )}

      {/* Queue Table */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
          Pending Ingestion Queue ({queue.length})
        </h2>

        {queue.length > 0 && (
          <div className="bg-[#0f1422] border border-zinc-800/80 rounded-xl overflow-hidden divide-y divide-zinc-800/80">
            {queue.map((item) => (
              <div
                key={item.submission_id}
                onClick={() => setSelectedSubmission(item)}
                className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                  selectedSubmission?.submission_id === item.submission_id
                    ? 'bg-zinc-800/70 border-l-2 border-emerald-400'
                    : 'hover:bg-zinc-850/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Film className="w-4 h-4 text-zinc-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-zinc-200">{item.file_name}</span>
                    <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                      {item.task_title || 'Workspace'} • {formatBytes(item.file_size_bytes || 27839158)} • {item.duration_seconds || 300}s
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="text-zinc-500">{item.worker_email || item.worker_id}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/70 text-emerald-400 border border-emerald-800/50">
                    QC PASS
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dataset Manifest Section */}
      {approvedManifest && (
        <div className="bg-[#0f1422] border border-zinc-800/80 rounded-xl p-4.5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
                Approved Dataset Manifest (Ready for AI Training)
              </h3>
            </div>
            <span className="text-xs font-mono text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
              {approvedManifest.total_approved_videos || 1} Videos ({formatBytes(approvedManifest.total_size_bytes || 27839158)})
            </span>
          </div>

          <p className="text-xs text-zinc-400">
            Approved videos are cataloged for downstream training. Run this command on your GPU server to ingest:
          </p>

          <div className="bg-[#070a10] p-2.5 rounded-lg border border-zinc-800 font-mono text-xs text-emerald-400 flex items-center justify-between">
            <code>python3 scripts/local_ai_sync.py --server http://localhost:8000 --dest ./local_training_data</code>
          </div>
        </div>
      )}
    </div>
  );
}
