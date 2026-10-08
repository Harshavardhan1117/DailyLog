import React, { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SUPABASE_SCHEMA_SQL = `-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  job_title TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TEAMS TABLE
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  invite_code TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TEAM MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- 4. STANDUP UPDATES TABLE
CREATE TABLE IF NOT EXISTS public.standup_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  update_date DATE NOT NULL DEFAULT CURRENT_DATE,
  worked_on TEXT NOT NULL,
  next_plan TEXT NOT NULL,
  blockers TEXT NOT NULL DEFAULT 'None.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id, update_date)
);

-- 5. CHAT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;

const SUPABASE_RLS_SQL = `-- Enable Row Level Security (RLS) on all 6 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standup_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Helper function: verify current user belongs to team
CREATE OR REPLACE FUNCTION public.is_team_member(check_team_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = check_team_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: read profiles needed by teams; edit own profile
CREATE POLICY "Read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Edit own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Teams & Team Members: read teams user belongs to
CREATE POLICY "Read joined teams" ON public.teams FOR SELECT TO authenticated USING (public.is_team_member(id) OR owner_id = auth.uid());
CREATE POLICY "Create team" ON public.teams FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "See team members" ON public.team_members FOR SELECT TO authenticated USING (public.is_team_member(team_id));

-- Standup Updates: read team updates; create/edit/delete own update
CREATE POLICY "Read team updates" ON public.standup_updates FOR SELECT TO authenticated USING (public.is_team_member(team_id));
CREATE POLICY "Insert own update" ON public.standup_updates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_team_member(team_id));
CREATE POLICY "Update own update" ON public.standup_updates FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Delete own update" ON public.standup_updates FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Chat Messages: read team messages; send/edit/delete own messages
CREATE POLICY "Read team chat" ON public.chat_messages FOR SELECT TO authenticated USING (public.is_team_member(team_id));
CREATE POLICY "Send team chat" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_team_member(team_id));
CREATE POLICY "Edit own chat" ON public.chat_messages FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Delete own chat" ON public.chat_messages FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Tasks: read/create/update tasks in joined teams; delete tasks created by user
CREATE POLICY "Read team tasks" ON public.tasks FOR SELECT TO authenticated USING (public.is_team_member(team_id));
CREATE POLICY "Create team tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.is_team_member(team_id));
CREATE POLICY "Update team tasks" ON public.tasks FOR UPDATE TO authenticated USING (public.is_team_member(team_id));
CREATE POLICY "Delete own tasks" ON public.tasks FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Enable Supabase Realtime on standup_updates, chat_messages, and tasks
ALTER TABLE public.standup_updates REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.standup_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;`;

export function SqlSetupModal({ isOpen, onClose }: SqlSetupModalProps) {
  const [copiedTab, setCopiedTab] = useState<'schema' | 'rls' | null>(null);

  if (!isOpen) return null;

  const copyCode = (text: string, key: 'schema' | 'rls') => {
    navigator.clipboard.writeText(text);
    setCopiedTab(key);
    setTimeout(() => setCopiedTab(null), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sql-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2
              id="sql-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              Supabase SQL Schema, RLS Policies &amp; Realtime Setup
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete SQL for profiles, teams, team_members, standup_updates,
              chat_messages, and tasks (also saved in{' '}
              <code className="font-mono text-slate-700">
                supabase/schema.sql
              </code>
              ).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                1. PostgreSQL Tables (6 Tables)
              </h3>
              <button
                type="button"
                onClick={() => copyCode(SUPABASE_SCHEMA_SQL, 'schema')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                {copiedTab === 'schema' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied SQL</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Schema SQL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
              {SUPABASE_SCHEMA_SQL}
            </pre>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                2. Row Level Security (RLS) &amp; Realtime Publication
              </h3>
              <button
                type="button"
                onClick={() => copyCode(SUPABASE_RLS_SQL, 'rls')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                {copiedTab === 'rls' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied Policies</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy RLS &amp; Realtime SQL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
              {SUPABASE_RLS_SQL}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
