import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';
import { apiRequest, getLocalTodayDate } from '../lib/supabase.ts';
import { StandupUpdateItem } from '../hooks/useRealtimeStandups.ts';
import { StandupCard } from '../components/StandupCard.tsx';
import { Loading } from '../components/Loading.tsx';
import { EmptyState } from '../components/EmptyState.tsx';

type DateRangePreset = 'today' | 'yesterday' | 'week' | 'custom';

/**
 * Team Update History page (/team/:teamId/history).
 * Provides simple date controls:
 * - Today
 * - Yesterday
 * - This Week
 * - Select Date
 * Shows updates grouped by date.
 */
export function TeamHistory() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const todayDate = useMemo(() => getLocalTodayDate(), []);

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

  const [preset, setPreset] = useState<DateRangePreset>('week');
  const [customDate, setCustomDate] = useState<string>(todayDate);
  const [teamName, setTeamName] = useState<string>('Team');
  const [allUpdates, setAllUpdates] = useState<StandupUpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!teamId) return;
    setError(null);
    try {
      const data = await apiRequest(`/api/teams/${teamId}/board`, {
        method: 'GET',
      });
      setTeamName(data.team?.name || 'Team');
      setAllUpdates(data.updates || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load standup history.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Filter updates according to selected date control
  const filteredUpdates = useMemo(() => {
    return allUpdates.filter((u) => {
      if (preset === 'today') return u.updateDate === todayDate;
      if (preset === 'yesterday') return u.updateDate === yesterdayDate;
      if (preset === 'week') {
        return u.updateDate >= weekAgoDate && u.updateDate <= todayDate;
      }
      if (preset === 'custom') {
        return u.updateDate === customDate;
      }
      return true;
    });
  }, [allUpdates, preset, todayDate, yesterdayDate, weekAgoDate, customDate]);

  // Group filtered updates by updateDate (newest date first)
  const groupedByDate = useMemo(() => {
    const map = new Map<string, StandupUpdateItem[]>();
    for (const item of filteredUpdates) {
      const list = map.get(item.updateDate) || [];
      list.push(item);
      map.set(item.updateDate, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredUpdates]);

  const handleDelete = async (updateId: string) => {
    await apiRequest(`/api/updates/${updateId}`, {
      method: 'DELETE',
    });
    setAllUpdates((prev) => prev.filter((u) => u.id !== updateId));
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Loading message="Loading standup update history..." />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <Link
            to={`/team/${teamId}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to {teamName} Board</span>
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {teamName} · Standup History
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Browse previous daily updates and blocker logs grouped by date.
          </p>
        </div>

        {/* Simple Date Controls: Today | Yesterday | This Week | Select Date */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setPreset('today')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                preset === 'today'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPreset('yesterday')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                preset === 'yesterday'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setPreset('week')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                preset === 'week'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => setPreset('custom')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                preset === 'custom'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Select Date
            </button>
          </div>

          {preset === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
            />
          )}
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

      {/* Updates Grouped by Date */}
      {groupedByDate.length === 0 ? (
        <EmptyState
          title="No updates found for this date range"
          description="Try switching to 'This Week' or select another date to view past team check-ins."
          actionLabel="Show This Week"
          onAction={() => setPreset('week')}
        />
      ) : (
        <div className="space-y-10">
          {groupedByDate.map(([dateStr, items]) => {
            const readableDate = new Date(`${dateStr}T12:00:00`).toLocaleDateString(
              undefined,
              {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }
            );
            return (
              <section key={dateStr} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h2 className="text-sm font-bold text-slate-900">
                    {readableDate}
                    {dateStr === todayDate && (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        · Today
                      </span>
                    )}
                    {dateStr === yesterdayDate && (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        · Yesterday
                      </span>
                    )}
                  </h2>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {items.length} {items.length === 1 ? 'update' : 'updates'}
                  </span>
                </div>

                <div className="space-y-4">
                  {items.map((update) => (
                    <StandupCard
                      key={update.id}
                      update={update}
                      currentUserId={user?.uid}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
