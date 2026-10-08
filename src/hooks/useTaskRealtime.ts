import React, { useEffect, useState } from 'react';
import { subscribeToTasks } from '../lib/supabase.ts';

export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskPerson {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string;
  avatarUrl: string;
}

export interface TaskItem {
  id: string;
  teamId: string;
  teamName?: string;
  createdBy: string;
  assignedTo: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  creator?: TaskPerson | null;
  assignee?: TaskPerson | null;
}

/**
 * Custom React hook that subscribes to Realtime `tasks` changes
 * (INSERT, UPDATE, DELETE) and automatically unsubscribes when unmounted.
 */
export function useTaskRealtime(
  myTeamIds: string[],
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>
) {
  const [realtimeStatus, setRealtimeStatus] = useState<'SUBSCRIBED' | 'ERROR'>(
    'SUBSCRIBED'
  );

  useEffect(() => {
    const teamIdSet = new Set(myTeamIds);

    const unsubscribe = subscribeToTasks(
      (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          if (!newRecord) return;
          if (teamIdSet.size > 0 && !teamIdSet.has(newRecord.teamId)) {
            return;
          }
          setTasks((prev) => {
            const exists = prev.some((t) => t.id === newRecord.id);
            const next = exists
              ? prev.map((t) =>
                  t.id === newRecord.id ? { ...t, ...newRecord } : t
                )
              : [newRecord as TaskItem, ...prev];
            return next.sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            );
          });
        } else if (eventType === 'DELETE' && oldRecord?.id) {
          setTasks((prev) => prev.filter((t) => t.id !== oldRecord.id));
        }
      },
      (status) => setRealtimeStatus(status)
    );

    return () => {
      unsubscribe();
    };
  }, [myTeamIds.join(','), setTasks]);

  return { realtimeStatus };
}
