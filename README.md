# Team Collaboration

**Team Collaboration** is a beginner-friendly full-stack team workspace that combines:
1. **Daily Standups** (structured three-question status updates & blocker visibility)
2. **Realtime Group Chat** (shared team chat room with live updates)
3. **Team Member Visibility** (member roles, active status, owner management, leave team)
4. **Update History** (browse previous updates grouped by date)

## 1. Project Folder Structure

```text
src/
├── components/
│   ├── Navbar.tsx           # Main navigation ("Team Collaboration", My Teams, Profile, Logout)
│   ├── StandupCard.tsx      # Daily standup update card with blocker alert highlight
│   ├── StandupForm.tsx      # 3-question form (Post Today's Update / Edit Today's Update)
│   ├── TeamCard.tsx         # Team overview card with invite code & quick links
│   ├── TeamStats.tsx        # Members, Posted Today, Missing Today, Blockers counter bar
│   ├── Chat.tsx             # Realtime team group chat container
│   ├── ChatMessage.tsx      # Individual chat message with edit & delete support
│   ├── ChatInput.tsx        # Enter-to-send, Shift+Enter-for-newline chat input
│   ├── MemberList.tsx       # Sidebar list of team members with Owner/Member roles
│   ├── Loading.tsx          # Skeleton loading state
│   └── EmptyState.tsx       # Beginner-friendly empty state component
├── pages/
│   ├── Landing.tsx          # `/` Landing page
│   ├── Login.tsx            # `/login` Login & signup page
│   ├── Teams.tsx            # `/teams` Create, join, or open team workspaces
│   ├── TeamWorkspace.tsx    # `/team/:teamId` & `/team/:teamId/chat` workspace
│   ├── History.tsx          # `/team/:teamId/history` Standup history by date
│   └── Profile.tsx          # `/profile` Edit username, avatar URL, and role
├── hooks/
│   ├── useAuth.tsx          # Authentication state & profile persistence
│   ├── useStandupRealtime.ts# Realtime INSERT/UPDATE/DELETE hook for standup_updates
│   └── useChatRealtime.ts   # Realtime INSERT/UPDATE/DELETE hook for chat_messages
├── lib/
│   └── supabase.ts          # Supabase client, Realtime subscriptions & Vercel adapter
├── App.tsx
└── main.tsx
```

## 2. Environment Variables (`.env.example`)

```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-public-anon-key"
```

*Never expose a Supabase `service_role` key in frontend code.*

## 3. Setup Instructions

1. Run the SQL script in `supabase/schema.sql` inside your Supabase SQL Editor to create:
   - `profiles`
   - `teams`
   - `team_members`
   - `standup_updates` (with `UNIQUE(team_id, user_id, update_date)`)
   - `chat_messages`
   - Row Level Security (RLS) policies for all 5 tables
   - Supabase Realtime publication for `standup_updates` and `chat_messages`
2. Install and start the app locally in VS Code:
   ```bash
   npm install
   npm run dev
   ```

## 4. Seed / Demo Data Instructions

1. Sign up or log in on `/login`.
2. On `/teams`, click **"Load Demo Team & Sample Updates"** to automatically create **Core Product Team** with sample teammates (**Harsh**, **Rahul**, **Ananya**, and **Kiran**), today's standup updates, and group chat messages.
3. Open the team workspace to switch between **Standup**, **Chat**, **History**, and **Members**.
