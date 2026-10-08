import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, getLocalTodayDate } from '../lib/supabase.ts';
import { TeamCard, TeamSummary } from '../components/TeamCard.tsx';
import { Loading } from '../components/Loading.tsx';
import { EmptyState } from '../components/EmptyState.tsx';

/**
 * User's Teams page (/teams).
 * Allows users to view their teams, create a new team, join a team via invite code,
 * or seed a complete demo team with sample updates in one click.
 */
export function Teams() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create team form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Join team form state
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Demo seed state
  const [seeding, setSeeding] = useState(false);

  const navigate = useNavigate();

  const loadTeams = useCallback(async () => {
    setError(null);
    try {
      const today = getLocalTodayDate();
      const data = await apiRequest(`/api/teams?today=${today}`, {
        method: 'GET',
      });
      setTeams(data.teams || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load your teams.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const data = await apiRequest('/api/teams', {
        method: 'POST',
        body: {
          name: newTeamName.trim(),
          description: newTeamDesc.trim(),
        },
      });
      setNewTeamName('');
      setNewTeamDesc('');
      setShowCreateForm(false);
      navigate(`/team/${data.team.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create team.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoining(true);
    setError(null);
    try {
      const data = await apiRequest('/api/teams/join', {
        method: 'POST',
        body: { inviteCode: inviteCode.trim() },
      });
      setInviteCode('');
      setShowJoinForm(false);
      navigate(`/team/${data.team.id}`);
    } catch (err: any) {
      setError(err?.message || 'Could not join team with that invite code.');
    } finally {
      setJoining(false);
    }
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    setError(null);
    try {
      const today = getLocalTodayDate();
      const data = await apiRequest('/api/teams/seed-demo', {
        method: 'POST',
        body: { today },
      });
      navigate(`/team/${data.team.id}`);
    } catch (err: any) {
      setError(err?.message || 'Could not load demo team.');
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Loading message="Loading your teams..." />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Teams</h1>
          <p className="mt-1 text-sm text-slate-600">
            Select a team bulletin board to post today&apos;s update or review teammate progress.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowJoinForm((prev) => !prev);
              setShowCreateForm(false);
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Join with Code
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreateForm((prev) => !prev);
              setShowJoinForm(false);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Create Team
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {/* Create Team Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateTeam}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 max-w-xl"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Create a New Team
            </h2>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div>
            <label
              htmlFor="team-name"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Team Name
            </label>
            <input
              id="team-name"
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="e.g., Frontend Platform, Mobile App Squad"
              required
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>
          <div>
            <label
              htmlFor="team-desc"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="team-desc"
              type="text"
              value={newTeamDesc}
              onChange={(e) => setNewTeamDesc(e.target.value)}
              placeholder="e.g., Daily async updates for the Q4 product launch"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Team Board'}
            </button>
          </div>
        </form>
      )}

      {/* Join Team Form */}
      {showJoinForm && (
        <form
          onSubmit={handleJoinTeam}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 max-w-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Join a Team via Invite Code
            </h2>
            <button
              type="button"
              onClick={() => setShowJoinForm(false)}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div>
            <label
              htmlFor="invite-code"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Team Invite Code
            </label>
            <input
              id="invite-code"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g., CORE-8F2A1B"
              required
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono uppercase text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={joining}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {joining ? 'Joining...' : 'Join Team'}
            </button>
          </div>
        </form>
      )}

      {/* Teams Grid or Empty State */}
      {teams.length === 0 ? (
        <EmptyState
          title="You haven’t joined any teams yet"
          description="Create your first team workspace, enter an invite code from a teammate, or load a ready-made demo team with Harsh, Rahul, Ananya, and Kiran to explore Standups and Realtime Chat."
          actionLabel="Create Your First Team"
          onAction={() => setShowCreateForm(true)}
          secondaryActionLabel={
            seeding ? 'Loading Demo Team...' : 'Load Demo Team & Sample Updates'
          }
          onSecondaryAction={handleSeedDemo}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200">
            <span>
              Want to test with sample teammates (Harsh, Rahul, Ananya, Kiran)?
            </span>
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedDemo}
              className="font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-4 cursor-pointer disabled:opacity-50"
            >
              {seeding ? 'Seeding demo team...' : '+ Add Demo Team with Sample Data'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
