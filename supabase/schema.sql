-- =============================================================================
-- TEAM COLLABORATION - SUPABASE SQL SCHEMA, RLS POLICIES & REALTIME SETUP
-- =============================================================================
-- Run this script in your Supabase SQL Editor to configure all 6 tables.

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. PROFILES TABLE (Linked to auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  job_title TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automatically create a profile row when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. TEAMS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  invite_code TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. TEAM MEMBERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- -----------------------------------------------------------------------------
-- 4. STANDUP UPDATES TABLE
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 5. CHAT MESSAGES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. TASKS TABLE
-- -----------------------------------------------------------------------------
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
);

-- Keep updated_at current on row edits
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_standup_updates_updated_at ON public.standup_updates;
CREATE TRIGGER trg_standup_updates_updated_at
  BEFORE UPDATE ON public.standup_updates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_chat_messages_updated_at ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standup_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the current user belongs to a team
CREATE OR REPLACE FUNCTION public.is_team_member(check_team_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = check_team_id
      AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles Policies
CREATE POLICY "Users can read profiles needed by their teams"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can edit their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Teams Policies
CREATE POLICY "Members can read teams they belong to"
  ON public.teams FOR SELECT
  TO authenticated
  USING (public.is_team_member(id) OR owner_id = auth.uid());

CREATE POLICY "Authenticated users can create teams"
  ON public.teams FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their team"
  ON public.teams FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete their team"
  ON public.teams FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Team Members Policies
CREATE POLICY "Users can see members of teams they belong to"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (public.is_team_member(team_id));

CREATE POLICY "Users can join or owners can add members"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE id = team_members.team_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can leave or owners can remove members"
  ON public.team_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE id = team_members.team_id AND owner_id = auth.uid()
    )
  );

-- Standup Updates Policies
CREATE POLICY "Read updates from teams they belong to"
  ON public.standup_updates FOR SELECT
  TO authenticated
  USING (public.is_team_member(team_id));

CREATE POLICY "Create their own update in teams they belong to"
  ON public.standup_updates FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    public.is_team_member(team_id)
  );

CREATE POLICY "Update their own update"
  ON public.standup_updates FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND public.is_team_member(team_id))
  WITH CHECK (user_id = auth.uid() AND public.is_team_member(team_id));

CREATE POLICY "Delete their own update"
  ON public.standup_updates FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Chat Messages Policies
CREATE POLICY "Read messages from teams they belong to"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (public.is_team_member(team_id));

CREATE POLICY "Send messages to teams they belong to"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    public.is_team_member(team_id)
  );

CREATE POLICY "Edit their own messages"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND public.is_team_member(team_id))
  WITH CHECK (user_id = auth.uid() AND public.is_team_member(team_id));

CREATE POLICY "Delete their own messages"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Tasks Policies
CREATE POLICY "Read tasks from teams they belong to"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (public.is_team_member(team_id));

CREATE POLICY "Create tasks in teams they belong to"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    public.is_team_member(team_id)
  );

CREATE POLICY "Update tasks in teams they belong to"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (public.is_team_member(team_id))
  WITH CHECK (public.is_team_member(team_id));

CREATE POLICY "Delete tasks they created"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- =============================================================================
-- 8. SUPABASE REALTIME CONFIGURATION
-- =============================================================================
-- Enable Realtime PostgreSQL CDC (INSERT, UPDATE, DELETE) for all 3 collaboration tables
ALTER TABLE public.standup_updates REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.standup_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
