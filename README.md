# Team Collaboration

**Team Collaboration** is a beginner-friendly full-stack team workspace that combines:
1. **Daily Standup Log** (three-question daily updates + blocker highlighting)
2. **Realtime Group Chat** (live team messaging, editing, and deletion)
3. **Task Management** (three-column board: To Do, In Progress, Completed)
4. **Team Member Visibility** (who posted today vs. who is missing)
5. **Update History** (filter by Today, Yesterday, This Week, or custom date)

---

## 1. Project Folder Structure

```text
├── supabase/
│   └── schema.sql                  # Full Supabase PostgreSQL schema, RLS policies & Realtime setup
├── src/
│   ├── lib/
│   │   ├── supabase.ts             # Supabase client, Realtime channels & API adapter
│   │   ├── supabase.js             # JS module re-export
│   │   ├── firebase.ts             # Client auth helper
│   │   └── firebase-admin.ts       # Server token verification
│   ├── db/
│   │   ├── schema.ts               # Drizzle PostgreSQL schema (6 tables)
│   │   ├── index.ts                # PostgreSQL connection pool
│   │   └── queries.ts              # Database queries for profiles, teams, standups, chat, tasks
│   ├── hooks/
│   │   ├── useAuth.tsx             # Authentication state & session persistence
│   │   ├── useStandupRealtime.ts   # Realtime subscription hook for standup_updates
│   │   ├── useChatRealtime.ts      # Realtime subscription hook for chat_messages
│   │   └── useTaskRealtime.ts      # Realtime subscription hook for tasks
│   ├── components/
│   │   ├── Navbar.tsx              # Top navigation: Team Collaboration | My Teams | Tasks | Profile | Logout
│   │   ├── ProtectedRoute.tsx      # Route guard for authenticated pages
│   │   ├── TeamCard.tsx            # Team summary card with invite code copy
│   │   ├── TeamStats.tsx           # Members, Updated Today, Missing, Blockers bar
│   │   ├── StandupForm.tsx         # 3-question daily standup form
│   │   ├── StandupCard.tsx         # Daily standup card with blocker highlight
│   │   ├── Chat.tsx                # Realtime group chat room
│   │   ├── ChatMessage.tsx         # Single chat message with edit/delete
│   │   ├── ChatInput.tsx           # Message input bar (Enter to send)
│   │   ├── TaskForm.tsx            # Create / Edit task form
│   │   ├── TaskCard.tsx            # Task card with Start / Complete / Edit / Delete actions
│   │   ├── TaskColumn.tsx          # Kanban status column (To Do, In Progress, Completed)
│   │   ├── MemberList.tsx          # Team member list with posted status & owner controls
│   │   ├── SqlSetupModal.tsx       # In-app SQL schema & RLS viewer
│   │   ├── Loading.tsx             # Skeleton loading indicator
│   │   └── EmptyState.tsx          # Friendly empty state card
│   ├── pages/
│   │   ├── Landing.tsx             # Overview page (/)
│   │   ├── Login.tsx               # Sign up & Login page (/login)
│   │   ├── Teams.tsx               # Create, join & view teams (/teams)
│   │   ├── Tasks.tsx               # 3-column Task Management board (/tasks)
│   │   ├── TeamWorkspace.tsx       # Central team workspace (/team/:teamId)
│   │   ├── History.tsx             # Standup history page (/team/:teamId/history)
│   │   └── Profile.tsx             # User profile settings (/profile)
│   ├── App.tsx                     # Application router
│   └── main.tsx                    # React entry point
└── server.ts                       # Express + PostgreSQL + Realtime SSE server
```

---

## 2. Database Tables (`supabase/schema.sql`)

1. `profiles` (`id`, `email`, `full_name`, `job_title`, `avatar_url`, `created_at`, `updated_at`)
2. `teams` (`id`, `name`, `description`, `invite_code`, `owner_id`, `created_at`)
3. `team_members` (`id`, `team_id`, `user_id`, `role`, `joined_at` — `UNIQUE(team_id, user_id)`)
4. `standup_updates` (`id`, `team_id`, `user_id`, `update_date`, `worked_on`, `next_plan`, `blockers`, `created_at`, `updated_at` — `UNIQUE(team_id, user_id, update_date)`)
5. `chat_messages` (`id`, `team_id`, `user_id`, `message`, `created_at`, `updated_at`)
6. `tasks` (`id`, `team_id`, `created_by`, `assigned_to`, `title`, `description`, `status`, `priority`, `due_date`, `created_at`, `updated_at`)

---

## 3. Running Locally & Testing with Sample Data

1. Install packages:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and add your Supabase URL and Anon Key (or use the built-in PostgreSQL database):
   ```env
   VITE_SUPABASE_URL="https://your-project-id.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-key"
   ```
3. In the Supabase SQL Editor, run `supabase/schema.sql` to create all 6 tables, Row Level Security (RLS) policies, and `supabase_realtime` publications.
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Log in and click **"Load Demo Team"** on `/teams` or `/tasks` to seed **Core Product Team** with sample teammates (Harsh, Rahul, Ananya, Kiran), daily standup updates, group chat messages, and tasks across **To Do**, **In Progress**, and **Completed**.
