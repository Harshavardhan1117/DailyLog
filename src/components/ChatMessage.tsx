import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { ChatMessageItem } from '../hooks/useChatRealtime.ts';

interface ChatMessageProps {
  message: ChatMessageItem;
  currentUserId?: string;
  onEdit: (messageId: string, newText: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
}

function getInitials(name?: string, email?: string): string {
  const source = (name || email || 'TM').trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

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
 * Displays a single chat message with user name, avatar/initials, message text,
 * timestamp, and edit/delete actions for the author.
 */
export function ChatMessage({
  message,
  currentUserId,
  onEdit,
  onDelete,
}: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(message.message);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwnMessage = Boolean(
    currentUserId && message.userId === currentUserId
  );

  const authorName =
    message.author?.fullName ||
    message.author?.email?.split('@')[0] ||
    'Team Member';
  const initials = getInitials(authorName, message.author?.email);
  const timeString = formatTime(message.createdAt);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftText.trim()) return;
    setSaving(true);
    try {
      await onEdit(message.id, draftText.trim());
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(message.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="group flex items-start gap-3 py-3 px-3 rounded-lg hover:bg-slate-50 transition-colors">
      {/* User Avatar or Initials */}
      {message.author?.avatarUrl ? (
        <img
          src={message.author.avatarUrl}
          alt={authorName}
          referrerPolicy="no-referrer"
          className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0 mt-0.5"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
          aria-hidden="true"
        >
          {initials}
        </div>
      )}

      {/* Message Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-slate-900 truncate">
              {authorName}
            </span>
            {isOwnMessage && (
              <span className="text-xs text-slate-500">· You</span>
            )}
            <time
              dateTime={message.createdAt}
              className="text-xs text-slate-400 font-mono tabular-nums"
            >
              {timeString}
            </time>
          </div>

          {isOwnMessage && !isEditing && (
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => {
                  setDraftText(message.message);
                  setIsEditing(true);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                title="Edit message"
                aria-label="Edit message"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer disabled:opacity-50"
                title="Delete message"
                aria-label="Delete message"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="mt-2 space-y-2">
            <textarea
              rows={2}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded-md cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
            {message.message}
          </p>
        )}
      </div>
    </div>
  );
}
