'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Database, CheckSquare, Plus, ArrowRight } from 'lucide-react';
import { TaskStudio } from '@/components/TaskStudio';

export default function AdminPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Campaign Operations Studio</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-300">
              DATASET ADMIN
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Publish structured video collection campaigns with strict duration, codec, and acceptance standards.
          </p>
        </div>

        <Link
          href="/admin/review"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-200 rounded-lg text-xs font-mono border border-zinc-800 transition-colors btn-press self-start sm:self-auto"
        >
          <CheckSquare className="w-3.5 h-3.5 text-zinc-300" />
          <span>Open Review Station</span>
          <ArrowRight className="w-3 h-3 ml-1" />
        </Link>
      </div>

      {/* Task Creation & Campaigns Component */}
      <TaskStudio onTaskCreated={() => setRefreshTrigger((prev) => prev + 1)} />
    </div>
  );
}
