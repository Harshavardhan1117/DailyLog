import React, { useState } from 'react';
import { LogOut, UserMinus } from 'lucide-react';

export interface WorkspaceMember {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    jobTitle: string;
    avatarUrl: string;
  };
}

interface MemberListProps {
  members: WorkspaceMember[];
  postedUserIds: Set<string>;
  currentUserId?: string;
  isCurrentUserOwner: boolean;
  onRemoveMember: (memberUserId: string) => Promise<void>;
  onLeaveTeam: () => Promise<void>;
}

/**
 * Displays the Team Members list in the workspace sidebar or Members tab.
 * - Shows active/posted indicator, member name, and role (Owner / Member)
 * - Allows the team owner to remove members
 * - Allows members to leave the team
 */
export function MemberList({
  members,
  postedUserIds,
  currentUserId,
  isCurrentUserOwner,
  onRemoveMember,
  onLeaveTeam,
}: MemberListProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const handleRemove = async (userId: string) => {
    setRemovingId(userId);
    try {
      await onRemoveMember(userId);
    } finally {
      setRemovingId(null);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await onLeaveTeam();
    } finally {
      setLeaving(false);
    }
  };

  return (
    <aside className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-sm font-bold text-slate-900">Team Members</h2>
        <span className="text-xs font-mono tabular-nums text-slate-500">
          {members.length}
        </span>
      </div>

      <ul className="space-y-2.5">
        {members.map((m) => {
          const name =
            m.user.fullName || m.user.email?.split('@')[0] || 'Member';
          const isMe = m.user.id === currentUserId;
          const isOwner = m.role === 'owner';
          const hasPostedToday = postedUserIds.has(m.user.id) || isMe;

          return (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 py-1.5 text-sm"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Status Indicator */}
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    hasPostedToday ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                  title={
                    hasPostedToday
                      ? 'Active / Posted today'
                      : 'No standup posted today yet'
                  }
                />
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 truncate">
                    {name}
                    {isMe && (
                      <span className="text-xs text-slate-400 font-normal">
                        {' '}
                        (You)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 capitalize">
                    {isOwner ? 'Owner' : 'Member'}
                    {m.user.jobTitle ? ` · ${m.user.jobTitle}` : ''}
                  </div>
                </div>
              </div>

              {isCurrentUserOwner && !isMe && (
                <button
                  type="button"
                  disabled={removingId === m.user.id}
                  onClick={() => handleRemove(m.user.id)}
                  className="p-1.5 text-xs text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                  title={`Remove ${name} from team`}
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Updated / Active</span>
        </div>
        <button
          type="button"
          disabled={leaving}
          onClick={handleLeave}
          className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer disabled:opacity-50"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{leaving ? 'Leaving...' : 'Leave Team'}</span>
        </button>
      </div>
    </aside>
  );
}
