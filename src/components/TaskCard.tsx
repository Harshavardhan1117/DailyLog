import React, { useState } from 'react';
import { Calendar, CheckCircle2, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react';
import { TaskItem, TaskStatus } from '../hooks/useTaskRealtime.ts';

interface TaskCardProps {
  task: TaskItem;
  currentUserId?: string;
  showTeamBadge?: boolean;
  onStatusChange: (taskId: string, nextStatus: TaskStatus) => Promise<void>;
  onEdit: (task: TaskItem) => void;
  onDelete: (taskId: string) => Promise<void>;
}

function formatDueDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Displays a single task card inside a Kanban column (To Do, In Progress, Completed).
 * Includes quick status transition buttons (Start, Complete, Move back to To Do),
 * Edit, and Delete actions.
 */
export function TaskCard({
  task,
  currentUserId,
  showTeamBadge = false,
  onStatusChange,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const assigneeName =
    task.assignee?.fullName ||
    task.assignee?.email?.split('@')[0] ||
    'Unassigned';

  const priorityLabel =
    task.priority === 'high'
      ? 'High'
      : task.priority === 'low'
        ? 'Low'
        : 'Medium';

  const priorityStyles =
    task.priority === 'high'
      ? 'text-amber-900 bg-amber-50 border-amber-300'
      : task.priority === 'low'
        ? 'text-slate-600 bg-slate-50 border-slate-200'
        : 'text-blue-800 bg-blue-50 border-blue-200';

  const canDelete = !currentUserId || task.createdBy === currentUserId;

  const handleMove = async (nextStatus: TaskStatus) => {
    setBusy(true);
    try {
      await onStatusChange(task.id, nextStatus);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await onDelete(task.id);
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs transition-colors hover:border-slate-300">
      {/* Top row: Priority + Team name + Edit/Delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-block px-2 py-0.5 text-[11px] font-semibold border rounded-md ${priorityStyles}`}
          >
            Priority: {priorityLabel}
          </span>
          {showTeamBadge && task.teamName && (
            <span className="text-[11px] font-medium text-slate-500">
              · {task.teamName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(task)}
            disabled={busy}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            title="Edit task"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {canDelete && !confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
              title="Delete task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Task Title & Description */}
      <div>
        <h4
          className={`text-sm font-bold text-slate-900 leading-snug ${
            task.status === 'completed' ? 'line-through text-slate-500' : ''
          }`}
        >
          {task.title}
        </h4>
        {task.description && (
          <p className="mt-1 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
            {task.description}
          </p>
        )}
      </div>

      {/* Metadata: Assigned to & Due date */}
      <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
        <div className="flex items-center justify-between gap-2">
          <span>
            Assigned to:{' '}
            <strong className="font-semibold text-slate-800">
              {assigneeName}
            </strong>
          </span>
        </div>

        {task.dueDate && (
          <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>Due: {formatDueDate(task.dueDate)}</span>
          </div>
        )}
      </div>

      {/* Delete confirmation inline */}
      {confirmDelete && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-red-800">
            Delete this task?
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="px-2 py-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Quick Status Transition Actions */}
      <div className="pt-1 flex flex-wrap items-center gap-1.5">
        {task.status === 'todo' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleMove('in_progress')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              <span>Start</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleMove('completed')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Complete</span>
            </button>
          </>
        )}

        {task.status === 'in_progress' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleMove('completed')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Complete</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleMove('todo')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Move to To Do</span>
            </button>
          </>
        )}

        {task.status === 'completed' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleMove('todo')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Move to To Do</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleMove('in_progress')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              <span>In Progress</span>
            </button>
          </>
        )}
      </div>
    </article>
  );
}
