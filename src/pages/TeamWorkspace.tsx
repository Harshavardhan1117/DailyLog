import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, Radio } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';
import { apiRequest, getLocalTodayDate } from '../lib/supabase.ts';
import {
  StandupUpdateItem,
  useStandupRealtime,
} from '../hooks/useStandupRealtime.ts';
import { TeamStats } from '../components/TeamStats.tsx';
import { StandupForm } from '../components/StandupForm.tsx';
import { StandupCard, hasActiveBlocker } from '../components/StandupCard.tsx';
import { Chat } from '../components/Chat.tsx';
import { MemberList, WorkspaceMember } from '../components/MemberList.tsx';
import { Loading } from '../components/Loading.tsx';
import { EmptyState } from '../components/EmptyState.tsx';

interface TeamDetails {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  ownerId: string;
}

type WorkspaceTab = 'standup' | 'chat' | 'history' | 'members';
type DateRangePreset = 'today' | 'yesterday' | 'week' | 'custom';

/**
 * Central Team Workspace page (/team/:teamId and /team/:teamId/chat).
 * Combines:
 * 1. Daily Standup Log (with Realtime updates)
 * 2. Realtime Group Chat
 * 3. Update History
 * 4. Team Members sidebar & management
 */
export function TeamWorkspace() {
  const { teamId } = useParams<{ teamId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const todayDate = useMemo(() => getLocalTodayDate(), []);

  // Determine initial tab from URL (/team/:teamId/chat vs /team/:teamId)
  const initialTab: WorkspaceTab = location.pathname.endsWith('/chat')
    ? 'chat'
    : 'standup';

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [myRole, setMyRole] = useState<string>('member');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [allUpdates, setAllUpdates] = useState<StandupUpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingOpen, setIsEditingOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [simulating, setSimulating] = useState(false);

  // History filter controls when viewing the History tab
  const [historyPreset, setHistoryPreset] = useState<DateRangePreset>('week');
  const [customDate, setCustomDate] = useState<string>(todayDate);

  useEffect(() => {
    if (location.pathname.endsWith('/chat')) {
      setActiveTab('chat');
    } else if (location.pathname.endsWith('/history')) {
      setActiveTab('history');
    }
  }, [location.pathname]);

  // Subscribe to Realtime standup_updates changes for this team
  const { realtimeStatus } = useStandupRealtime(
    teamId,
    '',
    setAllUpdates
  );

  const fetchWorkspace = useCallback(async () => {
    if (!teamId) return;
    setError(null);
    try {
      const data = await apiRequest(`/api/teams/${teamId}/board`, {
        method: 'GET',
      });
      setTeam(data.team);
      setMyRole(data.myRole || 'member');
      setMembers(data.members || []);
      setAllUpdates(data.updates || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load team workspace.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  // Filter today's standup updates
  const todaysUpdates = useMemo(() => {
    return allUpdates.filter((u) => u.updateDate === todayDate);
  }, [allUpdates, todayDate]);

  // Check if current user has already posted today
  const myTodayUpdate = useMemo(() => {
    if (!user) return null;
    return todaysUpdates.find((u) => u.userId === user.uid) || null;
  }, [todaysUpdates, user]);

  // Calculate Team Statistics for today
  const stats = useMemo(() => {
    const totalMembers = members.length;
    const postedUserIds = new Set(todaysUpdates.map((u) => u.userId));
    const postedToday = postedUserIds.size;
    const missingMembers = members.filter(
      (m) => !postedUserIds.has(m.user.id)
    );
    const missingToday = Math.max(0, totalMembers - postedToday);
    const blockersCount = todaysUpdates.filter((u) =>
      hasActiveBlocker(u.blockers)
    ).length;

    return {
      totalMembers,
      postedToday,
      missingToday,
      blockersCount,
      postedUserIds,
      missingMemberNames: missingMembers.map(
        (m) => m.user.fullName || m.user.email.split('@')[0]
      ),
    };
  }, [members, todaysUpdates]);

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

    const savedRecord: StandupUpdateItem = data.update;
    setAllUpdates((prev) => {
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
    setAllUpdates((prev) => prev.filter((u) => u.id !== updateId));
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
      const boardData = await apiRequest(`/api/teams/${teamId}/board`, {
        method: 'GET',
      });
      setMembers(boardData.members || []);
      setAllUpdates(boardData.updates || []);
    } catch (err: any) {
      setError(err?.message || 'Could not simulate realtime update.');
    } finally {
      setSimulating(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!teamId) return;
    try {
      await apiRequest(`/api/teams/${teamId}/members/${memberUserId}`, {
        method: 'DELETE',
      });
      setMembers((prev) => prev.filter((m) => m.user.id !== memberUserId));
    } catch (err: any) {
      setError(err?.message || 'Could not remove member.');
    }
  };

  const handleLeaveTeam = async () => {
    if (!teamId) return;
    try {
      await apiRequest(`/api/teams/${teamId}/leave`, {
        method: 'DELETE',
      });
      navigate('/teams');
    } catch (err: any) {
      setError(err?.message || 'Could not leave team.');
    }
  };

  const copyInviteCode = () => {
    if (!team) return;
    navigator.clipboard.writeText(team.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  // History date filtering
  const yesterdayDate = useMemo(() => {
    const d = new Date(`${todayDate}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [todayDate]);

  const weekAgoDate = useMemo(() => {
    const d = new Date(`${todayDate}T12:00:00`);
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, [todayDate]);

  const groupedHistory = useMemo(() => {
    const filtered = allUpdates.filter((u) => {
      if (historyPreset === 'today') return u.updateDate === todayDate;
      if (historyPreset === 'yesterday') return u.updateDate === yesterdayDate;
      if (historyPreset === 'week')
        return u.updateDate >= weekAgoDate && u.updateDate <= todayDate;
      if (historyPreset === 'custom') return u.updateDate === customDate;
      return true;
    });
    const map = new Map<string, StandupUpdateItem[]>();
    for (const item of filtered) {
      const list = map.get(item.updateDate) || [];
      list.push(item);
      map.set(item.updateDate, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allUpdates, historyPreset, todayDate, yesterdayDate, weekAgoDate, customDate]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Loading message="Opening team workspace..." />
      </div>
    );
  }

  if (error && !team) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <EmptyState
          title="Unable to open team workspace"
          description={error}
          actionLabel="Back to My Teams"
          onAction={() => navigate('/teams')}
        />
      </div>
    );
  }

  const isOwner = myRole === 'owner' || team?.ownerId === user?.uid;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Link to="/teams" className="hover:text-slate-900">
              My Teams
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-slate-700">{team?.name}</span>
          </div>

          <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900">
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
              <span>Invite Code: {team.inviteCode}</span>
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          )}
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

      {/* Workspace Navigation Tabs: [ Standup ] [ Chat ] [ History ] [ Members ] */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('standup')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'standup'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Standup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            History
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`lg:hidden px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'members'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Members ({members.length})
          </button>
        </div>

        <Link
          to={`/team/${teamId}/history`}
          className="hidden sm:inline-block text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          Open Full History Page →
        </Link>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {/* Responsive Desktop Layout: Sidebar (Team Members) + Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar on Desktop */}
        <div className="hidden lg:block lg:col-span-3">
          <MemberList
            members={members}
            postedUserIds={stats.postedUserIds}
            currentUserId={user?.uid}
            isCurrentUserOwner={isOwner}
            onRemoveMember={handleRemoveMember}
            onLeaveTeam={handleLeaveTeam}
          />
        </div>

        {/* Main Workspace Content Area */}
        <div className="lg:col-span-9 space-y-6">
          {/* TAB 1: DAILY STANDUP */}
          {activeTab === 'standup' && (
            <>
              <StandupForm
                existingUpdate={myTodayUpdate}
                onSubmit={handleSaveStandup}
                isEditingOpen={isEditingOpen}
                setIsEditingOpen={setIsEditingOpen}
              />

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      Today&apos;s Standup Updates
                    </h2>
                    <span className="text-xs text-slate-500 font-mono tabular-nums">
                      · {todaysUpdates.length}{' '}
                      {todaysUpdates.length === 1 ? 'update' : 'updates'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span
                      className={`inline-flex items-center gap-1.5 font-medium ${
                        realtimeStatus === 'SUBSCRIBED'
                          ? 'text-emerald-700'
                          : 'text-slate-500'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>
                        {realtimeStatus === 'SUBSCRIBED'
                          ? 'Realtime Active'
                          : 'Connecting...'}
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
                        : 'Simulate Teammate Update'}
                    </button>
                  </div>
                </div>

                {todaysUpdates.length === 0 ? (
                  <EmptyState
                    title="Nobody has posted today's standup yet"
                    description="Submit your three-question update above or click below to simulate a live teammate update."
                    actionLabel="Simulate Teammate Update"
                    onAction={handleSimulateRealtimeTeammate}
                  />
                ) : (
                  <div className="space-y-4">
                    {todaysUpdates.map((update) => (
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
            </>
          )}

          {/* TAB 2: GROUP CHAT */}
          {activeTab === 'chat' && teamId && (
            <Chat teamId={teamId} teamName={team?.name || 'Team'} />
          )}

          {/* TAB 3: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-bold text-slate-900">
                  Filter Standup History
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
                    {(
                      [
                        ['today', 'Today'],
                        ['yesterday', 'Yesterday'],
                        ['week', 'This Week'],
                        ['custom', 'Select Date'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setHistoryPreset(key)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                          historyPreset === key
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {historyPreset === 'custom' && (
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                  )}
                </div>
              </div>

              {groupedHistory.length === 0 ? (
                <EmptyState
                  title="No updates found for this date range"
                  description="Switch to 'This Week' or select another date to browse past updates."
                  actionLabel="Show This Week"
                  onAction={() => setHistoryPreset('week')}
                />
              ) : (
                <div className="space-y-8">
                  {groupedHistory.map(([dateStr, items]) => (
                    <section key={dateStr} className="space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          {new Date(`${dateStr}T12:00:00`).toLocaleDateString(
                            undefined,
                            {
                              weekday: 'long',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }
                          )}
                        </h3>
                        <span className="text-xs font-mono tabular-nums text-slate-500">
                          {items.length}{' '}
                          {items.length === 1 ? 'update' : 'updates'}
                        </span>
                      </div>
                      <div className="space-y-4">
                        {items.map((upd) => (
                          <StandupCard
                            key={upd.id}
                            update={upd}
                            currentUserId={user?.uid}
                            onDelete={handleDeleteStandup}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MEMBERS (Mobile view) */}
          {activeTab === 'members' && (
            <MemberList
              members={members}
              postedUserIds={stats.postedUserIds}
              currentUserId={user?.uid}
              isCurrentUserOwner={isOwner}
              onRemoveMember={handleRemoveMember}
              onLeaveTeam={handleLeaveTeam}
            />
          )}
        </div>
      </div>
    </div>
  );
}
