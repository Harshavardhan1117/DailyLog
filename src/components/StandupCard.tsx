import React, { useState } from 'react';
import { AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { StandupUpdateItem } from '../hooks/useRealtimeStandups.ts';

interface StandupCardProps {
  update: StandupUpdateItem;
  currentUserId?: string;
  onEdit?: (update: StandupUpdateItem) => void;
  onDelete?: (updateId: string) => Promise<void>;
}

/**
 * Checks whether the blocker text represents an actual blocker vs "None" / empty.
 */
export function hasActiveBlocker(blockerText?: string): boolean {
  if (!blockerText) return false;
  const cleaned = blockerText.trim().toLowerCase();
  if (!cleaned) return false;
  const nonBlockers = [
    'none',
    'none.',
    'no',
    'no.',
    'n/a',
    'na',
    'nothing',
    'nothing.',
    'no blockers',
    'no blockers.',
    'nil',
    '-',
  ];
  return !nonBlockers.includes(cleaned);
}

/**
 * Returns 1-2 character uppercase initials from a name or email.
 */
function getInitials(name?: string, email?: string): string {
  const source = (name || email || 'TM').trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/**
 * Formats a timestamp into a clean time string like "2:10 PM".
 */
function formatTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Displays a single member's daily standup update card on the bulletin board.
 * Highlights blockers clearly and allows the author to edit or delete their own update.
 */
export function StandupCard({
  update,
  currentUserId,
  onEdit,
  onDelete,
}: StandupCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = Boolean(currentUserId && update.userId === currentUserId);
  const blockerActive = hasActiveBlocker(update.blockers);

  const authorName =
    update.author?.fullName ||
    update.author?.email?.split('@')[0] ||
    'Team Member';
  const authorTitle = update.author?.jobTitle || '';
  const initials = getInitials(authorName, update.author?.email);
  const timeString = formatTime(update.updatedAt || update.createdAt);

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(update.id);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <article
      className={`bg-white rounded-xl p-6 transition-colors border ${
        blockerActive
          ? 'border-red-300 border-l-4 border-l-red-600'
          : 'border-slate-200'
      }`}
    >
      {/* Header: Avatar/Initials + Name + Blocker indicator + Timestamp/Actions */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          {update.author?.avatarUrl ? (
            <img
              src={update.author.avatarUrl}
              alt={authorName}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              {initials}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 truncate">
                {authorName}
              </h3>
              {isOwner && (
                <span className="text-xs text-slate-500">· You</span>
              )}
              {blockerActive && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                  <span aria-hidden="true">·</span>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Blocker Reported</span>
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              {authorTitle && <span>{authorTitle}</span>}
              {authorTitle && timeString && <span aria-hidden="true">·</span>}
              {timeString && (
                <time
                  dateTime={update.updatedAt}
                  className="font-mono tabular-nums"
                >
                  {timeString}
                </time>
              )}
            </div>
          </div>
        </div>

        {/* Author-only Edit / Delete controls */}
        {isOwner && (onEdit || onDelete) && (
          <div className="flex items-center gap-2 shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(update)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
            {onDelete && !confirmingDelete && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
            {onDelete && confirmingDelete && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="px-2.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Confirm'}
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirmingDelete(false)}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Three Standup Questions */}
      <div className="mt-4 space-y-4">
        <div>
          <div className="text-xs font-semibold text-slate-500">Worked on</div>
          <p className="mt-1 text-sm text-slate-900 whitespace-pre-line leading-relaxed">
            {update.workedOn}
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-500">Next</div>
          <p className="mt-1 text-sm text-slate-900 whitespace-pre-line leading-relaxed">
            {update.nextPlan}
          </p>
        </div>

        <div>
          <div
            className={`text-xs font-semibold ${
              blockerActive ? 'text-red-600' : 'text-slate-500'
            }`}
          >
            Blocker
          </div>
          <p
            className={`mt-1 text-sm whitespace-pre-line leading-relaxed ${
              blockerActive
                ? 'text-red-700 font-medium'
                : 'text-slate-600'
            }`}
          >
            {update.blockers || 'None.'}
          </p>
        </div>
      </div>
    </article>
  );
}
