import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Copy, History, Radio } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';
import { apiRequest, getLocalTodayDate } from '../lib/supabase.ts';
import {
  StandupUpdateItem,
  useRealtimeStandups,
} from '../hooks/useRealtimeStandups.ts';
import { TeamStats } from '../components/TeamStats.tsx';
import { StandupForm } from '../components/StandupForm.tsx';
import { StandupCard, hasActiveBlocker } from '../components/StandupCard.tsx';
import { Loading } from '../components/Loading.tsx';
import { EmptyState } from '../components/EmptyState.tsx';

interface TeamMemberRow {
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

interface TeamDetails {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  ownerId: string;
}

/**
 * Main Team Bulletin Board (/team/:teamId).
 * Displays:
 * - Team name, Today's date, Invite code, History link
 * - Team Statistics (Members, Posted Today, Missing Today, Blockers)
 * - Create/Edit Daily Update Form (3 questions)
 * - Realtime-synchronized Standup Cards sorted newest first
 */
export function TeamBoard() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const todayDate = useMemo(() => getLocalTodayDate(), []);

  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [updates, setUpdates] = useState<StandupUpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingOpen, setIsEditingOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [simulating, setSimulating] = useState(false);

  // Subscribe to Realtime INSERT / UPDATE / DELETE events for this team's standup_updates
  const { realtimeStatus } = useRealtimeStandups(
    teamId,
    todayDate,
    setUpdates
  );

  const fetchBoard = useCallback(async () => {
    if (!teamId) return;
    setError(null);
    try {
      const data = await apiRequest(
        `/api/teams/${teamId}/board?date=${todayDate}`,
        { method: 'GET' }
      );
      setTeam(data.team);
      setMembers(data.members || []);
      setUpdates(data.updates || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load team bulletin board.');
    } finally {
      setLoading(false);
    }
  }, [teamId, todayDate]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // Identify if the logged-in user already has an update for today
  const myTodayUpdate = useMemo(() => {
    if (!user) return null;
    return updates.find((u) => u.userId === user.uid) || null;
  }, [updates, user]);

  // Calculate Team Statistics
  const stats = useMemo(() => {
    const totalMembers = members.length;
    const postedUserIds = new Set(updates.map((u) => u.userId));
    const postedToday = postedUserIds.size;
    const missingMembers = members.filter(
      (m) => !postedUserIds.has(m.user.id)
    );
    const missingToday = Math.max(0, totalMembers - postedToday);
    const blockersCount = updates.filter((u) =>
      hasActiveBlocker(u.blockers)
    ).length;

    return {
      totalMembers,
      postedToday,
      missingToday,
      blockersCount,
      missingMemberNames: missingMembers.map(
        (m) => m.user.fullName || m.user.email.split('@')[0]
      ),
    };
  }, [members, updates]);

  const handleSaveStandup = async (formData: {
    workedOn: string;
    nextPlan: string;
    blockers: string;
  }) => {
    if (!teamId) return;
    const data = await apiRequest(`/api/teams/${teamId}/updates`, {
      method: 'POST',
      body: {
        updateDate: todayDate,
        ...formData,
      },
    });

    // Update local state immediately (Realtime also broadcasts to all other viewers)
    const savedRecord: StandupUpdateItem = data.update;
    setUpdates((prev) => {
      const exists = prev.some((u) => u.id === savedRecord.id);
      const next = exists
        ? prev.map((u) => (u.id === savedRecord.id ? savedRecord : u))
        : [savedRecord, ...prev];
      return next.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  };

  const handleDeleteStandup = async (updateId: string) => {
    await apiRequest(`/api/updates/${updateId}`, {
      method: 'DELETE',
    });
    setUpdates((prev) => prev.filter((u) => u.id !== updateId));
    setIsEditingOpen(false);
  };

  const handleSimulateRealtimeTeammate = async () => {
    if (!teamId) return;
    setSimulating(true);
    try {
      await apiRequest(`/api/teams/${teamId}/simulate-realtime`, {
        method: 'POST',
        body: { today: todayDate },
      });
      // Refresh members list in case Maya was newly added to the team
      const boardData = await apiRequest(
        `/api/teams/${teamId}/board?date=${todayDate}`,
        { method: 'GET' }
      );
      setMembers(boardData.members || []);
    } catch (err: any) {
      setError(err?.message || 'Could not simulate realtime update.');
    } finally {
      setSimulating(false);
    }
  };

  const copyInviteCode = () => {
    if (!team) return;
    navigator.clipboard.writeText(team.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const formattedReadableDate = useMemo(() => {
    try {
      return new Date(`${todayDate}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return todayDate;
    }
  }, [todayDate]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Loading message="Opening team bulletin board..." />
      </div>
    );
  }

  if (error && !team) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <EmptyState
          title="Unable to open team bulletin board"
          description={error}
          actionLabel="Back to My Teams"
          onAction={() => {
            window.location.href = '/teams';
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Top Section: Breadcrumb + Team Name + Today's Date + Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Link to="/teams" className="hover:text-slate-900">
              My Teams
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-slate-700">{team?.name}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {formattedReadableDate}
            </span>
          </div>

          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
            {team?.name}
          </h1>

          {team?.description && (
            <p className="mt-1 text-sm text-slate-600">{team.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {team?.inviteCode && (
            <button
              type="button"
              onClick={copyInviteCode}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              title="Copy invite code to share with teammates"
            >
              <span>Invite: {team.inviteCode}</span>
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          )}

          <Link
            to={`/team/${teamId}/history`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5" />
            <span>Update History</span>
          </Link>
        </div>
      </div>

      {/* Team Statistics Bar */}
      <TeamStats
        totalMembers={stats.totalMembers}
        postedToday={stats.postedToday}
        missingToday={stats.missingToday}
        blockersCount={stats.blockersCount}
        missingMemberNames={stats.missingMemberNames}
      />

      {/* Create / Edit Daily Update Form */}
      <StandupForm
        existingUpdate={myTodayUpdate}
        onSubmit={handleSaveStandup}
        isEditingOpen={isEditingOpen}
        setIsEditingOpen={setIsEditingOpen}
      />

      {/* Bulletin Board Feed Header + Realtime Indicator */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              Today&apos;s Bulletin Board
            </h2>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              · {updates.length} {updates.length === 1 ? 'update' : 'updates'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 font-medium ${
                realtimeStatus === 'SUBSCRIBED'
                  ? 'text-emerald-700'
                  : realtimeStatus === 'ERROR'
                  ? 'text-amber-600'
                  : 'text-slate-500'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>
                {realtimeStatus === 'SUBSCRIBED'
                  ? 'Realtime Connected'
                  : realtimeStatus === 'ERROR'
                  ? 'Realtime Reconnecting...'
                  : 'Connecting Realtime...'}
              </span>
            </span>

            <button
              type="button"
              disabled={simulating}
              onClick={handleSimulateRealtimeTeammate}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-4 cursor-pointer disabled:opacity-50"
            >
              {simulating
                ? 'Simulating...'
                : 'Simulate Teammate Live Post'}
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700"
          >
            {error}
          </div>
        )}

        {/* Updates List (Sorted newest first) */}
        {updates.length === 0 ? (
          <EmptyState
            title="No standup updates posted today yet"
            description="Be the first to share what you worked on, what is next, and any blockers using the form above—or simulate a teammate update to test live Realtime sync."
            actionLabel="Simulate Teammate Live Post"
            onAction={handleSimulateRealtimeTeammate}
          />
        ) : (
          <div className="space-y-4">
            {updates.map((update) => (
              <StandupCard
                key={update.id}
                update={update}
                currentUserId={user?.uid}
                onEdit={() => {
                  setIsEditingOpen(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onDelete={handleDeleteStandup}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
