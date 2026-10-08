import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string) => Promise<void>;
}

/**
 * Simple chat message input bar.
 * - Enter key sends the message
 * - Shift + Enter creates a new line
 */
export function ChatInput({ onSendMessage }: ChatInputProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const submitMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSendMessage(trimmed);
      setText('');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-slate-200 p-4 bg-slate-50 flex items-end gap-3"
    >
      <div className="flex-1">
        <label htmlFor="chat-message-input" className="sr-only">
          Type a message
        </label>
        <textarea
          id="chat-message-input"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Press Enter to send, Shift+Enter for new line)"
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={sending || !text.trim()}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
      >
        <span>{sending ? 'Sending...' : 'Send'}</span>
        <Send className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}
