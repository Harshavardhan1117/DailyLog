import React from 'react';

interface LoadingProps {
  message?: string;
}

/**
 * Clean skeleton loading placeholder for boards and pages.
 */
export function Loading({ message = 'Loading bulletin board...' }: LoadingProps) {
  return (
    <div className="w-full py-12" role="status" aria-live="polite">
      <div className="max-w-4xl mx-auto space-y-4">
        <p className="text-sm font-medium text-slate-500">{message}</p>
        <div className="space-y-3">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-200" />
                  <div className="h-4 w-32 bg-slate-200 rounded" />
                </div>
                <div className="h-3 w-16 bg-slate-100 rounded" />
              </div>
              <div className="h-3 w-3/4 bg-slate-100 rounded" />
              <div className="h-3 w-1/2 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
