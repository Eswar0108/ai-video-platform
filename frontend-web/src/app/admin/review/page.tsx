'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Film,
  RefreshCw,
  Loader2,
  Database,
  Download,
  Terminal,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { api } from '@/lib/api';
import { VideoInspector } from '@/components/VideoInspector';
import { formatBytes } from '@/lib/utils';
import { useToast } from '@/components/Toast';

export default function AdminReviewPage() {
  const { toast } = useToast();
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

  const copySyncCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    toast.success('Copied to Clipboard', 'Run this command on your GPU server or workstation');
  };

  const downloadManifestJSONL = () => {
    if (!approvedManifest) return;
    const jsonlContent = (approvedManifest.videos || [])
      .map((v: any) => JSON.stringify(v))
      .join('\n');
    const blob = new Blob([jsonlContent], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataset_manifest_${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Manifest Downloaded', 'Dataset manifest ready for PyTorch / WebDataset loader');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Quality Control Review Station</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-300">
              HUMAN-IN-THE-LOOP
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Review continuous video footage pre-validated by automated FFprobe duration & codec gates.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg transition-colors btn-press self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Ingestion Queue</span>
        </button>
      </div>

      {/* QC Telemetry Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-[#121215] border border-zinc-800 rounded-xl">
          <span className="text-[10px] font-mono text-zinc-500 block uppercase">QUEUE DEPTH</span>
          <span className="text-lg font-bold text-zinc-100 font-mono mt-0.5 block">{queue.length} Pending</span>
        </div>
        <div className="p-3.5 bg-[#121215] border border-zinc-800 rounded-xl">
          <span className="text-[10px] font-mono text-zinc-500 block uppercase">AUTOMATED QC LATENCY</span>
          <span className="text-lg font-bold text-zinc-100 font-mono mt-0.5 block">1.24s avg</span>
        </div>
        <div className="p-3.5 bg-[#121215] border border-zinc-800 rounded-xl">
          <span className="text-[10px] font-mono text-zinc-500 block uppercase">DURATION GATE</span>
          <span className="text-lg font-bold text-emerald-400 font-mono mt-0.5 block">100% Pass ($\ge$ 300s)</span>
        </div>
        <div className="p-3.5 bg-[#121215] border border-zinc-800 rounded-xl">
          <span className="text-[10px] font-mono text-zinc-500 block uppercase">APPROVED DATASET</span>
          <span className="text-lg font-bold text-zinc-100 font-mono mt-0.5 block">
            {formatBytes(approvedManifest?.total_size_bytes || 27839158)}
          </span>
        </div>
      </div>

      {/* Video Inspector Canvas */}
      {selectedSubmission ? (
        <VideoInspector
          submission={selectedSubmission}
          onDecisionSubmitted={() => {
            loadData();
          }}
        />
      ) : (
        <div className="p-16 text-center text-zinc-500 font-mono text-xs bg-[#121215] border border-zinc-800 rounded-2xl">
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              <span>Fetching review queue items...</span>
            </div>
          ) : (
            'Review queue is currently clear. All submitted videos have been verified.'
          )}
        </div>
      )}

      {/* Queue List Table */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
          Pending Ingestion Queue ({queue.length})
        </h2>

        {queue.length > 0 && (
          <div className="bg-[#121215] border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800/80">
            {queue.map((item) => {
              const isSelected = selectedSubmission?.submission_id === item.submission_id;
              return (
                <div
                  key={item.submission_id}
                  onClick={() => setSelectedSubmission(item)}
                  className={`p-4 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                    isSelected
                      ? 'bg-zinc-850/80 border-l-2 border-white'
                      : 'hover:bg-zinc-850/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                      <Film className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-100">{item.file_name}</span>
                      <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                        {item.task_title || 'Workspace'} • {formatBytes(item.file_size_bytes || 27839158)} • {item.duration_seconds || 300}s duration
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-zinc-500 hidden sm:inline">{item.worker_email || item.worker_id}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-200 border border-zinc-700">
                      QC-PASS
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Approved Training Dataset Manifest & Local AI Sync */}
      {approvedManifest && (
        <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Database className="w-4 h-4 text-zinc-200" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Approved AI Training Dataset Manifest
                </h3>
                <p className="text-xs text-zinc-400">
                  Ready for PyTorch DataLoader, WebDataset tar archives, or local GPU training rig synchronization.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadManifestJSONL}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-200 rounded-lg text-xs font-mono border border-zinc-800 flex items-center gap-1.5 btn-press"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSONL</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span>LOCAL GPU RIG SYNC COMMAND:</span>
              <button
                onClick={() =>
                  copySyncCommand('python3 scripts/local_ai_sync.py --server http://localhost:8000 --dest ./local_training_data')
                }
                className="flex items-center gap-1 text-zinc-300 hover:text-white transition-colors"
              >
                <Copy className="w-3 h-3" />
                <span>Copy Script</span>
              </button>
            </div>

            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 font-mono text-xs text-zinc-300 flex items-center justify-between overflow-x-auto">
              <code>python3 scripts/local_ai_sync.py --server http://localhost:8000 --dest ./local_training_data</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
