import React from 'react';

interface TeamStatsProps {
  totalMembers: number;
  postedToday: number;
  missingToday: number;
  blockersCount: number;
  missingMemberNames?: string[];
}

/**
 * Displays team statistics at the top of the team board:
 * Members · Posted Today · Missing Today · Blockers
 * Uses tabular numerals and single-elevation flat layout with hairline dividers.
 */
export function TeamStats({
  totalMembers,
  postedToday,
  missingToday,
  blockersCount,
  missingMemberNames = [],
}: TeamStatsProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        {/* Members */}
        <div className="p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Members</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {totalMembers}
            </span>
            <span className="text-xs text-slate-500">
              {totalMembers === 1 ? 'member' : 'members'}
            </span>
          </div>
        </div>

        {/* Posted Today */}
        <div className="p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Posted Today</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
              {postedToday}
            </span>
            <span className="text-xs text-slate-500">posted</span>
          </div>
        </div>

        {/* Missing Today */}
        <div className="p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Missing Today</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                missingToday > 0 ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {missingToday}
            </span>
            <span className="text-xs text-slate-500">missing</span>
          </div>
        </div>

        {/* Blockers */}
        <div className="p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-500">Blockers</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                blockersCount > 0 ? 'text-red-600' : 'text-slate-900'
              }`}
            >
              {blockersCount}
            </span>
            <span className="text-xs text-slate-500">
              {blockersCount === 1 ? 'blocker' : 'blockers'}
            </span>
          </div>
        </div>
      </div>

      {missingMemberNames.length > 0 && (
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-slate-700">Waiting on today:</span>
          <span>{missingMemberNames.join(' · ')}</span>
        </div>
      )}
    </div>
  );
}
