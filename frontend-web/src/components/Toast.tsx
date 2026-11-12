'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  description?: string;
}

interface ToastContextType {
  toast: {
    success: (message: string, description?: string) => void;
    error: (message: string, description?: string) => void;
    info: (message: string, description?: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string, description?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message, description }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const contextValue = {
    toast: {
      success: (message: string, description?: string) => addToast('success', message, description),
      error: (message: string, description?: string) => addToast('error', message, description),
      info: (message: string, description?: string) => addToast('info', message, description),
    },
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast Render Viewport */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 p-3.5 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 text-zinc-100 rounded-xl shadow-2xl animate-in-toast transition-all"
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {t.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
              {t.type === 'info' && <Info className="w-4 h-4 text-zinc-300" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-zinc-100 tracking-tight">{t.message}</div>
              {t.description && (
                <div className="text-[11px] text-zinc-400 font-mono mt-0.5 leading-relaxed">{t.description}</div>
              )}
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: {
        success: (m: string) => console.log('Toast:', m),
        error: (m: string) => console.error('Toast error:', m),
        info: (m: string) => console.log('Toast info:', m),
      },
    };
  }
  return ctx;
}
