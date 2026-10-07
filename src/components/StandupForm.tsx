import React, { useEffect, useState } from 'react';
import { StandupUpdateItem } from '../hooks/useRealtimeStandups.ts';

interface StandupFormProps {
  existingUpdate: StandupUpdateItem | null;
  onSubmit: (data: {
    workedOn: string;
    nextPlan: string;
    blockers: string;
  }) => Promise<void>;
  isEditingOpen: boolean;
  setIsEditingOpen: (open: boolean) => void;
}

/**
 * Simple three-question daily standup form:
 * 1. What did you work on?
 * 2. What are you working on next?
 * 3. Any blockers?
 *
 * Shows [ Post Update ] when the user has not posted today, or [ Edit Update ]
 * when the user already has today's update.
 */
export function StandupForm({
  existingUpdate,
  onSubmit,
  isEditingOpen,
  setIsEditingOpen,
}: StandupFormProps) {
  const [workedOn, setWorkedOn] = useState('');
  const [nextPlan, setNextPlan] = useState('');
  const [blockers, setBlockers] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingUpdate) {
      setWorkedOn(existingUpdate.workedOn || '');
      setNextPlan(existingUpdate.nextPlan || '');
      setBlockers(
        existingUpdate.blockers === 'None.' ? '' : existingUpdate.blockers || ''
      );
    } else {
      setWorkedOn('');
      setNextPlan('');
      setBlockers('');
    }
  }, [existingUpdate, isEditingOpen]);

  // If the user already posted today and hasn't clicked "Edit Update", show a compact banner
  if (existingUpdate && !isEditingOpen) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            You have posted today&apos;s standup update
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Need to add progress or report a new blocker? You can update your entry anytime today.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsEditingOpen(true)}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Edit Update
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!workedOn.trim() || !nextPlan.trim()) {
      setError(
        'Please fill out both "Worked on" and "Next" before posting your update.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        workedOn: workedOn.trim(),
        nextPlan: nextPlan.trim(),
        blockers: blockers.trim() || 'None.',
      });
      setIsEditingOpen(false);
    } catch (err: any) {
      setError(
        err?.message || 'Could not save your update. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {existingUpdate ? "Edit Today's Update" : "Post Today's Standup Update"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Share a quick three-question check-in with your team.
          </p>
        </div>
        {existingUpdate && (
          <button
            type="button"
            onClick={() => setIsEditingOpen(false)}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="worked-on"
          className="block text-xs font-semibold text-slate-700 mb-1.5"
        >
          1. Worked on <span className="text-slate-400 font-normal">(What did you work on?)</span>
        </label>
        <textarea
          id="worked-on"
          rows={2}
          value={workedOn}
          onChange={(e) => setWorkedOn(e.target.value)}
          placeholder="e.g., Completed the DBMS schema and tested authentication routes."
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
          required
        />
      </div>

      <div>
        <label
          htmlFor="next-plan"
          className="block text-xs font-semibold text-slate-700 mb-1.5"
        >
          2. Next <span className="text-slate-400 font-normal">(What are you working on next?)</span>
        </label>
        <textarea
          id="next-plan"
          rows={2}
          value={nextPlan}
          onChange={(e) => setNextPlan(e.target.value)}
          placeholder="e.g., Build the team bulletin board and wire up Realtime updates."
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
          required
        />
      </div>

      <div>
        <label
          htmlFor="blockers"
          className="block text-xs font-semibold text-slate-700 mb-1.5"
        >
          3. Blockers <span className="text-slate-400 font-normal">(Any blockers? Leave blank if none)</span>
        </label>
        <textarea
          id="blockers"
          rows={2}
          value={blockers}
          onChange={(e) => setBlockers(e.target.value)}
          placeholder="None. (Or describe what you're waiting on)"
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
        />
      </div>

      <div className="pt-2 flex items-center justify-end gap-3">
        {existingUpdate && (
          <button
            type="button"
            onClick={() => setIsEditingOpen(false)}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
        >
          {submitting
            ? 'Saving...'
            : existingUpdate
            ? 'Edit Update'
            : 'Post Update'}
        </button>
      </div>
    </form>
  );
}
