import { useEffect, useState } from 'react';
import { subscribeToTeamStandups } from '../lib/supabase.ts';

export interface StandupAuthor {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string;
  avatarUrl: string;
}

export interface StandupUpdateItem {
  id: string;
  teamId: string;
  userId: string;
  updateDate: string;
  workedOn: string;
  nextPlan: string;
  blockers: string;
  createdAt: string;
  updatedAt: string;
  author?: StandupAuthor;
}

/**
 * Custom hook that subscribes to Realtime PostgreSQL changes for `standup_updates`
 * filtered by `team_id` and updates React state immediately on INSERT, UPDATE, and DELETE.
 */
export function useRealtimeStandups(
  teamId: string | undefined,
  targetDate: string,
  setUpdates: React.Dispatch<React.SetStateAction<StandupUpdateItem[]>>
) {
  const [realtimeStatus, setRealtimeStatus] = useState<
    'CONNECTING' | 'SUBSCRIBED' | 'ERROR'
  >('CONNECTING');

  useEffect(() => {
    if (!teamId) return;

    setRealtimeStatus('CONNECTING');

    const unsubscribe = subscribeToTeamStandups(
      teamId,
      (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          if (!newRecord) return;
          // Only merge into today's board if updateDate matches targetDate
          const recordDate = newRecord.updateDate || newRecord.update_date;
          if (targetDate && recordDate && recordDate !== targetDate) {
            return;
          }

          setUpdates((prev) => {
            const exists = prev.some((item) => item.id === newRecord.id);
            let nextList: StandupUpdateItem[];
            if (exists) {
              nextList = prev.map((item) =>
                item.id === newRecord.id ? { ...item, ...newRecord } : item
              );
            } else {
              nextList = [newRecord, ...prev];
            }
            // Sort newest first by updatedAt
            return nextList.sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            );
          });
        } else if (eventType === 'DELETE') {
          const deletedId = oldRecord?.id;
          if (!deletedId) return;
          setUpdates((prev) => prev.filter((item) => item.id !== deletedId));
        }
      },
      (status) => {
        setRealtimeStatus(status);
      }
    );

    // Clean up Realtime subscription when the component unmounts
    return () => {
      unsubscribe();
    };
  }, [teamId, targetDate, setUpdates]);

  return { realtimeStatus };
}
