import React from 'react';
import { TaskItem, TaskStatus } from '../hooks/useTaskRealtime.ts';
import { TaskCard } from './TaskCard.tsx';

interface TaskColumnProps {
  title: string;
  status: TaskStatus;
  tasks: TaskItem[];
  currentUserId?: string;
  showTeamBadge?: boolean;
  onStatusChange: (taskId: string, nextStatus: TaskStatus) => Promise<void>;
  onEdit: (task: TaskItem) => void;
  onDelete: (taskId: string) => Promise<void>;
}

/**
 * Represents one status column on the Tasks board:
 * - To Do ('todo')
 * - In Progress ('in_progress')
 * - Completed ('completed')
 */
export function TaskColumn({
  title,
  status,
  tasks,
  currentUserId,
  showTeamBadge,
  onStatusChange,
  onEdit,
  onDelete,
}: TaskColumnProps) {
  const accentColor =
    status === 'completed'
      ? 'border-t-emerald-500'
      : status === 'in_progress'
        ? 'border-t-blue-600'
        : 'border-t-slate-400';

  return (
    <section
      className={`bg-slate-100/80 border border-slate-200 border-t-4 ${accentColor} rounded-xl p-4 flex flex-col min-h-[380px]`}
    >
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200/80">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <span className="px-2 py-0.5 text-xs font-mono font-semibold tabular-nums text-slate-700 bg-white border border-slate-200 rounded-md">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12 px-4 text-center border border-dashed border-slate-200 rounded-lg bg-white/50">
          <p className="text-xs text-slate-400">No tasks in {title}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              currentUserId={currentUserId}
              showTeamBadge={showTeamBadge}
              onStatusChange={onStatusChange}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}
