import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  TaskItem,
  TaskPerson,
  TaskPriority,
  TaskStatus,
} from '../hooks/useTaskRealtime.ts';

export interface TaskTeamOption {
  id: string;
  name: string;
  myRole: string;
  members: TaskPerson[];
}

interface TaskFormProps {
  teams: TaskTeamOption[];
  selectedTeamId?: string;
  editingTask: TaskItem | null;
  onClose: () => void;
  onSubmit: (data: {
    teamId: string;
    title: string;
    description: string;
    assignedTo: string | null;
    priority: TaskPriority;
    dueDate: string;
    status: TaskStatus;
  }) => Promise<void>;
}

/**
 * Form modal/card for creating or editing a team task.
 * Fields: Task Title, Description, Team, Assign To, Priority, Due Date (optional), Status.
 */
export function TaskForm({
  teams,
  selectedTeamId,
  editingTask,
  onClose,
  onSubmit,
}: TaskFormProps) {
  const defaultTeamId =
    editingTask?.teamId ||
    (selectedTeamId && selectedTeamId !== 'all' ? selectedTeamId : '') ||
    teams[0]?.id ||
    '';

  const [teamId, setTeamId] = useState<string>(defaultTeamId);
  const [title, setTitle] = useState<string>(editingTask?.title || '');
  const [description, setDescription] = useState<string>(
    editingTask?.description || ''
  );
  const [assignedTo, setAssignedTo] = useState<string>(
    editingTask?.assignedTo || ''
  );
  const [priority, setPriority] = useState<TaskPriority>(
    editingTask?.priority || 'medium'
  );
  const [dueDate, setDueDate] = useState<string>(editingTask?.dueDate || '');
  const [status, setStatus] = useState<TaskStatus>(
    editingTask?.status || 'todo'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingTask) {
      setTeamId(editingTask.teamId);
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setAssignedTo(editingTask.assignedTo || '');
      setPriority(editingTask.priority || 'medium');
      setDueDate(editingTask.dueDate || '');
      setStatus(editingTask.status || 'todo');
    }
  }, [editingTask]);

  const currentTeam = teams.find((t) => t.id === teamId) || teams[0];
  const availableMembers = currentTeam?.members || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please enter a Task Title.');
      return;
    }
    if (!teamId) {
      setError('Please select a team for this task.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        teamId,
        title: title.trim(),
        description: description.trim(),
        assignedTo: assignedTo || null,
        priority,
        dueDate: dueDate.trim(),
        status,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Unable to save task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {editingTask ? 'Edit Task' : 'Create Task'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {editingTask
              ? 'Update task details, assignee, priority, or status.'
              : 'Add a new task to your team board so everyone stays aligned.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close task form"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="task-title"
              className="block text-xs font-semibold text-slate-800 mb-1.5"
            >
              Task Title
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Fix login bug"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="task-description"
              className="block text-xs font-semibold text-slate-800 mb-1.5"
            >
              Description
            </label>
            <textarea
              id="task-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short context or acceptance criteria for this task..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <div>
            <label
              htmlFor="task-team"
              className="block text-xs font-semibold text-slate-800 mb-1.5"
            >
              Team
            </label>
            <select
              id="task-team"
              value={teamId}
              disabled={Boolean(editingTask)}
              onChange={(e) => {
                setTeamId(e.target.value);
                setAssignedTo('');
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="task-assignee"
              className="block text-xs font-semibold text-slate-800 mb-1.5"
            >
              Assign To
            </label>
            <select
              id="task-assignee"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {availableMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName || member.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="task-priority"
              className="block text-xs font-semibold text-slate-800 mb-1.5"
            >
              Priority
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="task-due-date"
              className="block text-xs font-semibold text-slate-800 mb-1.5"
            >
              Due Date (Optional)
            </label>
            <input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="task-status"
              className="block text-xs font-semibold text-slate-800 mb-1.5"
            >
              Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['todo', 'To Do'],
                  ['in_progress', 'In Progress'],
                  ['completed', 'Completed'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStatus(val)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    status === val
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
          >
            {submitting
              ? 'Saving...'
              : editingTask
                ? 'Save Changes'
                : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  );
}
