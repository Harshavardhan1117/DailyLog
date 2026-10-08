import { useEffect, useState } from 'react';
import { subscribeToTeamChat } from '../lib/supabase.ts';

export interface ChatAuthor {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string;
  avatarUrl: string;
}

export interface ChatMessageItem {
  id: string;
  teamId: string;
  userId: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  author?: ChatAuthor;
}

/**
 * Custom hook that subscribes to Supabase Realtime changes on `chat_messages`
 * filtered by `team_id`.
 * Handles:
 * - INSERT → Add message (idempotent check prevents duplicates)
 * - UPDATE → Update message
 * - DELETE → Remove message
 * Cleans up the subscription when the component unmounts.
 */
export function useChatRealtime(
  teamId: string | undefined,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageItem[]>>
) {
  const [chatRealtimeStatus, setChatRealtimeStatus] = useState<
    'CONNECTING' | 'SUBSCRIBED' | 'ERROR'
  >('CONNECTING');

  useEffect(() => {
    if (!teamId) return;

    setChatRealtimeStatus('CONNECTING');

    const unsubscribe = subscribeToTeamChat(
      teamId,
      (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        if (eventType === 'INSERT') {
          if (!newRecord) return;
          setMessages((prev) => {
            // Idempotent check: skip if message with this ID is already in state
            if (prev.some((m) => m.id === newRecord.id)) {
              return prev;
            }
            const next = [...prev, newRecord];
            return next.sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
            );
          });
        } else if (eventType === 'UPDATE') {
          if (!newRecord) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === newRecord.id ? { ...m, ...newRecord } : m
            )
          );
        } else if (eventType === 'DELETE') {
          const deletedId = oldRecord?.id;
          if (!deletedId) return;
          setMessages((prev) => prev.filter((m) => m.id !== deletedId));
        }
      },
      (status) => {
        setChatRealtimeStatus(status);
      }
    );

    // Clean up the realtime subscription when the component unmounts
    return () => {
      unsubscribe();
    };
  }, [teamId, setMessages]);

  return { chatRealtimeStatus };
}
