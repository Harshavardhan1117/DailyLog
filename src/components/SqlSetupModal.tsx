import React, { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SUPABASE_SCHEMA_SQL = `-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (linked to auth.users)
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
);`;

const SUPABASE_RLS_SQL = `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standup_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper: Check if authenticated user belongs to a team
CREATE OR REPLACE FUNCTION public.is_team_member(check_team_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = check_team_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: Read teammate profiles, edit own profile
CREATE POLICY "Read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Edit own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Teams: Read if member, owners can update
CREATE POLICY "Read team if member" ON public.teams
  FOR SELECT TO authenticated USING (public.is_team_member(id) OR owner_id = auth.uid());
CREATE POLICY "Owners manage team" ON public.teams
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Team Members: View members in same team, owners can add/remove
CREATE POLICY "View team members" ON public.team_members
  FOR SELECT TO authenticated USING (public.is_team_member(team_id));
CREATE POLICY "Manage team members" ON public.team_members
  FOR DELETE TO authenticated USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.teams WHERE id = team_members.team_id AND owner_id = auth.uid())
  );

-- Standup Updates: Read team updates, create/update/delete own update
CREATE POLICY "Read team updates" ON public.standup_updates
  FOR SELECT TO authenticated USING (public.is_team_member(team_id));
CREATE POLICY "Insert own standup update" ON public.standup_updates
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_team_member(team_id));
CREATE POLICY "Update own standup update" ON public.standup_updates
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own standup update" ON public.standup_updates
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Chat Messages: Read team messages, send/edit/delete own messages
CREATE POLICY "Read team chat" ON public.chat_messages
  FOR SELECT TO authenticated USING (public.is_team_member(team_id));
CREATE POLICY "Send team chat" ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_team_member(team_id));
CREATE POLICY "Edit own chat message" ON public.chat_messages
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own chat message" ON public.chat_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Enable Supabase Realtime for standup_updates and chat_messages
ALTER TABLE public.standup_updates REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.standup_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;`;

export function SqlSetupModal({ isOpen, onClose }: SqlSetupModalProps) {
  const [tab, setTab] = useState<'schema' | 'rls' | 'setup'>('schema');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Team Collaboration — Supabase SQL Schema, RLS & Realtime Setup
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete deliverables in <code className="font-mono">supabase/schema.sql</code> and <code className="font-mono">README.md</code>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-3 border-b border-slate-200 flex items-center gap-2 bg-slate-50">
          <button
            type="button"
            onClick={() => setTab('schema')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === 'schema'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            1. SQL Schema (5 Tables)
          </button>
          <button
            type="button"
            onClick={() => setTab('rls')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === 'rls'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            2. RLS & Realtime
          </button>
          <button
            type="button"
            onClick={() => setTab('setup')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === 'setup'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            3. Env & Setup Guide
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-sm">
          {tab === 'schema' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">
                  Tables: profiles, teams, team_members, standup_updates, chat_messages
                </span>
                <button
                  type="button"
                  onClick={() => copyText(SUPABASE_SCHEMA_SQL)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy SQL'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
                {SUPABASE_SCHEMA_SQL}
              </pre>
            </div>
          )}

          {tab === 'rls' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">
                  Row Level Security Policies & Realtime Publication
                </span>
                <button
                  type="button"
                  onClick={() => copyText(SUPABASE_RLS_SQL)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy SQL'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
                {SUPABASE_RLS_SQL}
              </pre>
            </div>
          )}

          {tab === 'setup' && (
            <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  Environment Variables (.env)
                </h3>
                <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key`}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  Quick Start & Demo Data Instructions
                </h3>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                  <li>
                    Sign up or log in on the <strong>/login</strong> page.
                  </li>
                  <li>
                    On <strong>/teams</strong>, click <strong>&ldquo;Load Demo Team &amp; Sample Data&rdquo;</strong> to seed a sample team with Harsh, Rahul, Ananya, and Kiran (including standup updates and chat messages).
                  </li>
                  <li>
                    Open the team workspace to switch seamlessly between <strong>[ Standup ]</strong>, <strong>[ Chat ]</strong>, <strong>[ History ]</strong>, and <strong>[ Members ]</strong>.
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
