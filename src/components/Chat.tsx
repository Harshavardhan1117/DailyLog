import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Radio } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';
import { apiRequest } from '../lib/supabase.ts';
import {
  ChatMessageItem,
  useChatRealtime,
} from '../hooks/useChatRealtime.ts';
import { ChatMessage } from './ChatMessage.tsx';
import { ChatInput } from './ChatInput.tsx';
import { EmptyState } from './EmptyState.tsx';
import { Loading } from './Loading.tsx';

interface ChatProps {
  teamId: string;
  teamName: string;
}

/**
 * Realtime Team Group Chat component.
 * - Subscribes to INSERT, UPDATE, and DELETE events on `chat_messages` filtered by `team_id`
 * - Shows newest messages at the bottom and auto-scrolls to the latest message
 * - Allows current user to edit or delete their own message
 */
export function Chat({ teamId, teamName }: ChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to Realtime chat_messages changes for this team
  const { chatRealtimeStatus } = useChatRealtime(teamId, setMessages);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadMessages = useCallback(async () => {
    setError(null);
    try {
      const data = await apiRequest(`/api/teams/${teamId}/chat`, {
        method: 'GET',
      });
      setMessages(data.messages || []);
    } catch {
      setError('Unable to load chat messages. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Automatically scroll to the latest message whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const handleSendMessage = async (text: string) => {
    setError(null);
    try {
      const data = await apiRequest(`/api/teams/${teamId}/chat`, {
        method: 'POST',
        body: { message: text },
      });
      const created: ChatMessageItem = data.message;
      setMessages((prev) => {
        if (prev.some((m) => m.id === created.id)) return prev;
        return [...prev, created];
      });
    } catch {
      setError('Unable to send message. Please try again.');
      throw new Error('Unable to send message. Please try again.');
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    setError(null);
    try {
      const data = await apiRequest(`/api/chat/${messageId}`, {
        method: 'PUT',
        body: { message: newText },
      });
      const updated: ChatMessageItem = data.message;
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m))
      );
    } catch {
      setError('Unable to update message. Please try again.');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setError(null);
    try {
      await apiRequest(`/api/chat/${messageId}`, {
        method: 'DELETE',
      });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {
      setError('Unable to delete message. Please try again.');
    }
  };

  if (loading) {
    return <Loading message="Loading team chat..." />;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-[560px]">
      {/* Chat Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Team Chat · {teamName}
          </h2>
          <p className="text-xs text-slate-500">
            Shared realtime chat room for all team members
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
            chatRealtimeStatus === 'SUBSCRIBED'
              ? 'text-emerald-700'
              : 'text-slate-500'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>
            {chatRealtimeStatus === 'SUBSCRIBED'
              ? 'Live Chat Connected'
              : 'Connecting...'}
          </span>
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="mx-4 mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              title="No chat messages yet"
              description="Start the conversation! Send a message below and everyone in the team will see it immediately."
            />
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                currentUserId={user?.uid}
                onEdit={handleEditMessage}
                onDelete={handleDeleteMessage}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Chat Input */}
      <ChatInput onSendMessage={handleSendMessage} />
    </div>
  );
}
