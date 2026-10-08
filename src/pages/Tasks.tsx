import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Radio } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';
import { apiRequest, getLocalTodayDate } from '../lib/supabase.ts';
import {
  TaskItem,
  TaskPriority,
  TaskStatus,
  useTaskRealtime,
} from '../hooks/useTaskRealtime.ts';
import { TaskForm, TaskTeamOption } from '../components/TaskForm.tsx';
import { TaskColumn } from '../components/TaskColumn.tsx';
import { Loading } from '../components/Loading.tsx';
import { EmptyState } from '../components/EmptyState.tsx';

type QuickFilter = 'all' | 'mine' | 'high';

/**
 * Tasks Page (/tasks) — directly next to My Teams in the main navigation.
 * Displays a clean 3-column task board (To Do, In Progress, Completed)
 * with realtime synchronization across team members.
 */
export function Tasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTeamParam = searchParams.get('teamId') || 'all';

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [teams, setTeams] = useState<TaskTeamOption[]>([]);
  const [selectedTeamId, setSelectedTeamId] =
    useState<string>(initialTeamParam);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);

  const loadTasksData = useCallback(async () => {
    setError(null);
    try {
      const data = await apiRequest('/api/tasks', { method: 'GET' });
      setTasks(data.tasks || []);
      setTeams(data.teams || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasksData();
  }, [loadTasksData]);

  const myTeamIds = useMemo(() => teams.map((t) => t.id), [teams]);
  const { realtimeStatus } = useTaskRealtime(myTeamIds, setTasks);

  const handleSelectTeam = (nextTeamId: string) => {
    setSelectedTeamId(nextTeamId);
    if (nextTeamId === 'all') {
      searchParams.delete('teamId');
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ teamId: nextTeamId }, { replace: true });
    }
  };

  // Filtered tasks by selected team and quick filter
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (selectedTeamId !== 'all' && task.teamId !== selectedTeamId) {
        return false;
      }
      if (quickFilter === 'mine' && task.assignedTo !== user?.uid) {
        return false;
      }
      if (quickFilter === 'high' && task.priority !== 'high') {
        return false;
      }
      return true;
    });
  }, [tasks, selectedTeamId, quickFilter, user?.uid]);

  const todoTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === 'todo'),
    [filteredTasks]
  );
  const inProgressTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === 'in_progress'),
    [filteredTasks]
  );
  const completedTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === 'completed'),
    [filteredTasks]
  );

  const handleSaveTask = async (formData: {
    teamId: string;
    title: string;
    description: string;
    assignedTo: string | null;
    priority: TaskPriority;
    dueDate: string;
    status: TaskStatus;
  }) => {
    if (editingTask) {
      const res = await apiRequest(`/api/tasks/${editingTask.id}`, {
        method: 'PUT',
        body: formData,
      });
      const updated: TaskItem = res.task;
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } else {
      const res = await apiRequest('/api/tasks', {
        method: 'POST',
        body: formData,
      });
      const created: TaskItem = res.task;
      setTasks((prev) => {
        if (prev.some((t) => t.id === created.id)) return prev;
        return [created, ...prev];
      });
    }
    setEditingTask(null);
  };

  const handleStatusChange = async (taskId: string, nextStatus: TaskStatus) => {
    setError(null);
    try {
      const res = await apiRequest(`/api/tasks/${taskId}`, {
        method: 'PUT',
        body: { status: nextStatus },
      });
      const updated: TaskItem = res.task;
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err: any) {
      setError(err?.message || 'Unable to update task. Please try again.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setError(null);
    try {
      await apiRequest(`/api/tasks/${taskId}`, { method: 'DELETE' });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err: any) {
      setError(err?.message || 'Unable to delete task. Please try again.');
    }
  };

  const handleSeedDemoTeam = async () => {
    setSeedingDemo(true);
    setError(null);
    try {
      await apiRequest('/api/teams/seed-demo', {
        method: 'POST',
        body: { today: getLocalTodayDate() },
      });
      await loadTasksData();
    } catch (err: any) {
      setError(err?.message || 'Could not seed demo team and tasks.');
    } finally {
      setSeedingDemo(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Loading message="Loading team tasks..." />
      </div>
    );
  }

  // If the user doesn't belong to any team yet, prompt them to create/join or seed demo team
  if (teams.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Keep track of what your team needs to do, what is in progress, and
            what is completed.
          </p>
        </div>

        <EmptyState
          title="Join or create a team to manage tasks"
          description="Tasks belong to a team workspace. Load a sample team with pre-populated tasks, standups, and chat, or create your own team first."
          actionLabel={
            seedingDemo
              ? 'Creating Demo Team & Tasks...'
              : 'Load Demo Team & Sample Tasks'
          }
          onAction={handleSeedDemoTeam}
          secondaryActionLabel="Go to My Teams"
          onSecondaryAction={() => navigate('/teams')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Assign tasks to teammates and track progress across To Do, In
            Progress, and Completed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
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
            onClick={() => {
              setEditingTask(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Task</span>
          </button>
        </div>
      </div>

      {/* Team Selector & Quick Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="team-filter-select"
            className="text-xs font-semibold text-slate-600"
          >
            Team:
          </label>
          <select
            id="team-filter-select"
            value={selectedTeamId}
            onChange={(e) => handleSelectTeam(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-slate-900 focus:outline-none"
          >
            <option value="all">All My Teams ({teams.length})</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
          {(
            [
              ['all', 'All Tasks'],
              ['mine', 'Assigned to Me'],
              ['high', 'High Priority'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setQuickFilter(key)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                quickFilter === key
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
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

      {/* Create / Edit Task Form */}
      {(isFormOpen || editingTask) && (
        <TaskForm
          teams={teams}
          selectedTeamId={selectedTeamId}
          editingTask={editingTask}
          onClose={() => {
            setIsFormOpen(false);
            setEditingTask(null);
          }}
          onSubmit={handleSaveTask}
        />
      )}

      {/* Three-Column Task Board: To Do | In Progress | Completed */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
        <TaskColumn
          title="To Do"
          status="todo"
          tasks={todoTasks}
          currentUserId={user?.uid}
          showTeamBadge={selectedTeamId === 'all' && teams.length > 1}
          onStatusChange={handleStatusChange}
          onEdit={(task) => {
            setEditingTask(task);
            setIsFormOpen(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onDelete={handleDeleteTask}
        />

        <TaskColumn
          title="In Progress"
          status="in_progress"
          tasks={inProgressTasks}
          currentUserId={user?.uid}
          showTeamBadge={selectedTeamId === 'all' && teams.length > 1}
          onStatusChange={handleStatusChange}
          onEdit={(task) => {
            setEditingTask(task);
            setIsFormOpen(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onDelete={handleDeleteTask}
        />

        <TaskColumn
          title="Completed"
          status="completed"
          tasks={completedTasks}
          currentUserId={user?.uid}
          showTeamBadge={selectedTeamId === 'all' && teams.length > 1}
          onStatusChange={handleStatusChange}
          onEdit={(task) => {
            setEditingTask(task);
            setIsFormOpen(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onDelete={handleDeleteTask}
        />
      </div>
    </div>
  );
}
