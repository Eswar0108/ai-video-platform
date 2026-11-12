'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Film, CheckSquare, Layers, ArrowRightLeft, Radio, Database, Sparkles, User, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { checkBackendConnection, api } from '@/lib/api';
import { useToast } from './Toast';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [queueCount, setQueueCount] = useState<number>(2);

  const isWorker = pathname.includes('/worker') || pathname === '/';
  const isReviewer = pathname.startsWith('/admin/review');
  const isStudio = pathname === '/admin' && !isReviewer;

  const handleCheckConnection = async () => {
    setChecking(true);
    const live = await checkBackendConnection();
    setIsLive(live);
    setChecking(false);
    if (live) {
      toast.success('FastAPI Backend Connected', 'Direct streaming to Python 3.11 engine on port 8000');
    } else {
      toast.info('Studio Preview Mode', 'Using local high-fidelity seeds & simulated multipart chunks');
    }
  };

  useEffect(() => {
    checkBackendConnection().then(setIsLive);
    api.getReviewQueue().then((q) => setQueueCount(q.length)).catch(() => {});
  }, [pathname]);

  const toggleRole = () => {
    if (isWorker) {
      router.push('/admin/review');
      toast.info('Switched to Reviewer Role', 'Viewing incoming submissions and automated QC diagnostics');
    } else {
      router.push('/worker');
      toast.info('Switched to Worker Role', 'Viewing collection campaigns and upload station');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand Logo & Telemetry Pill */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100 group-hover:border-zinc-600 transition-colors">
                <Film className="w-3.5 h-3.5 text-zinc-200" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-sm tracking-tight text-zinc-100">
                  OmniVideo
                </span>
                <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
                  STUDIO
                </span>
              </div>
            </Link>

            {/* Connection Status Pill with Ping Action */}
            <button
              onClick={handleCheckConnection}
              disabled={checking}
              className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono border bg-zinc-900/80 hover:bg-zinc-800 border-zinc-800 text-zinc-400 transition-colors btn-press cursor-pointer"
              title="Click to re-check FastAPI backend health"
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                )}
              />
              <span>{checking ? 'Pinging...' : isLive ? 'FastAPI 8000 Live' : 'Studio Preview'}</span>
              <RefreshCw className={cn('w-2.5 h-2.5 text-zinc-500 ml-0.5', checking && 'animate-spin')} />
            </button>
          </div>

          {/* Segmented Workspace Navigation */}
          <nav className="flex items-center p-0.5 bg-zinc-900/90 border border-zinc-800/90 rounded-lg">
            <Link
              href="/worker"
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-all btn-press flex items-center gap-1.5',
                isWorker
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Film className="w-3.5 h-3.5 text-zinc-300" />
              <span>Worker Station</span>
            </Link>

            <Link
              href="/admin/review"
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-all btn-press flex items-center gap-1.5',
                isReviewer
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <CheckSquare className="w-3.5 h-3.5 text-zinc-300" />
              <span>QC Review</span>
              {queueCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-300">
                  {queueCount}
                </span>
              )}
            </Link>

            <Link
              href="/admin"
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-all btn-press flex items-center gap-1.5',
                isStudio
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Database className="w-3.5 h-3.5 text-zinc-300" />
              <span>Campaigns</span>
            </Link>
          </nav>

          {/* Role Indicator & 1-Click Toggle */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-zinc-200">
                {isWorker ? 'Alex (Contributor)' : 'QC Reviewer Lead'}
              </div>
              <div className="text-[10px] font-mono text-zinc-500">
                {isWorker ? 'worker@example.com' : 'admin@example.com'}
              </div>
            </div>

            <button
              onClick={toggleRole}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-800 transition-all btn-press"
              title="Switch role between Worker and QC Reviewer"
            >
              <ArrowRightLeft className="w-3 h-3 text-zinc-400" />
              <span className="hidden sm:inline">
                {isWorker ? 'Switch to QC' : 'Switch to Worker'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
