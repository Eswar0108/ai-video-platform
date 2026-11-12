'use client';

import React, { useState } from 'react';
import { Database, Plus, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export function TaskStudio({ onTaskCreated }: { onTaskCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Spatial AI & Robotics');
  const [duration, setDuration] = useState(300); // 5 min default
  const [slots, setSlots] = useState(10);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      await api.createTask({
        title,
        description,
        category,
        min_duration_seconds: duration,
        max_duration_seconds: duration * 6,
        required_codec: 'h264',
        min_resolution: '1920x1080',
        total_slots: slots,
      });

      setSuccess(true);
      setTitle('');
      setDescription('');
      onTaskCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-zinc-100 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
        <Database className="w-4 h-4 text-purple-400" />
        <h2 className="text-sm font-semibold text-zinc-200">Publish Video Collection Campaign</h2>
      </div>

      {success && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs rounded flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>Campaign published to PostgreSQL and live on Worker Station!</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-zinc-400 font-mono mb-1">Campaign Title</label>
          <input
            type="text"
            required
            placeholder="e.g. 5-Minute Kitchen Object Interaction"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 focus:border-zinc-600 outline-none"
          />
        </div>

        <div>
          <label className="block text-zinc-400 font-mono mb-1">Worker Instructions</label>
          <textarea
            required
            rows={3}
            placeholder="Describe the continuous motions, camera angle, and environment guidelines..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 focus:border-zinc-600 outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-zinc-400 font-mono mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-400 font-mono mb-1">Min Duration (Sec)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-400 font-mono mb-1">Worker Slots</label>
            <input
              type="number"
              value={slots}
              onChange={(e) => setSlots(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs rounded transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Publish Campaign to Worker Station
        </button>
      </form>
    </div>
  );
}
