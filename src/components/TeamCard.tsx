import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Copy } from 'lucide-react';

export interface TeamSummary {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
  myRole: string;
  memberCount: number;
  postedTodayCount: number;
  blockersTodayCount: number;
}

interface TeamCardProps {
  team: TeamSummary;
}

/**
 * Clean single-elevation card displaying a team summary and invite code.
 */
export function TeamCard({ team }: TeamCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(team.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:border-slate-300 transition-colors">
      <div>
        {/* Unboxed metadata header */}
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="capitalize font-medium text-slate-700">
              {team.myRole}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyInvite}
            className="inline-flex items-center gap-1 text-xs font-mono text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title="Click to copy team invite code"
          >
            <span>Code: {team.inviteCode}</span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
        </div>

        <h3 className="mt-2.5 text-lg font-bold text-slate-900">
          <Link
            to={`/team/${team.id}`}
            className="hover:underline underline-offset-4"
          >
            {team.name}
          </Link>
        </h3>

        <p className="mt-1.5 text-sm text-slate-600 line-clamp-2 leading-relaxed">
          {team.description || 'Daily async status updates and blocker visibility.'}
        </p>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-600 font-mono tabular-nums">
          <span>
            {team.postedTodayCount}/{team.memberCount} posted today
          </span>
          {team.blockersTodayCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-red-600 font-semibold">
                {team.blockersTodayCount}{' '}
                {team.blockersTodayCount === 1 ? 'blocker' : 'blockers'}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to={`/team/${team.id}/history`}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            History
          </Link>
          <Link
            to={`/team/${team.id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <span>Open Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
