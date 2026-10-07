# Daily Standup Log

A clean, beginner-friendly full-stack web application where teams post short daily status updates (three questions) and immediately see updates and blockers from teammates in real time.

## 1. Project Folder Structure

```text
/
├── .env.example                  # Environment variable template
├── server.ts                     # Express + PostgreSQL + Realtime SSE server
├── supabase/
│   └── schema.sql                # Complete Supabase SQL schema, RLS policies & Realtime setup
├── src/
│   ├── components/
│   │   ├── EmptyState.tsx        # Beginner-friendly empty states
│   │   ├── Loading.tsx           # Skeleton loading placeholders
│   │   ├── Navbar.tsx            # Main navigation bar
│   │   ├── ProtectedRoute.tsx    # Route guard for authenticated pages
│   │   ├── SqlSetupModal.tsx     # In-app viewer for SQL schema & RLS policies
│   │   ├── StandupCard.tsx       # Individual standup update card with blocker highlight
│   │   ├── StandupForm.tsx       # 3-question create/edit daily update form
│   │   ├── TeamCard.tsx          # Team summary card with invite code copy
│   │   └── TeamStats.tsx         # Members / Posted Today / Missing / Blockers bar
│   ├── db/
│   │   ├── drizzle.config.ts     # Drizzle Kit configuration
│   │   ├── index.ts              # PostgreSQL connection pool
│   │   ├── queries.ts            # Sanitized query helpers & demo seeder
│   │   └── schema.ts             # PostgreSQL tables & unique constraints
│   ├── hooks/
│   │   ├── useAuth.tsx           # Authentication context & profile synchronization
│   │   └── useRealtimeStandups.ts# Realtime INSERT / UPDATE / DELETE subscription hook
│   ├── lib/
│   │   ├── firebase.ts           # Client auth initialization
│   │   ├── firebase-admin.ts     # Backend token verification
│   │   ├── supabase.js           # JS re-export bridge
│   │   └── supabase.ts           # Supabase client & Realtime subscription adapter
│   ├── pages/
│   │   ├── Landing.tsx           # `/` Landing page
│   │   ├── Login.tsx             # `/login` Login & signup page
│   │   ├── Teams.tsx             # `/teams` User's teams list, create & join
│   │   ├── TeamBoard.tsx         # `/team/:teamId` Daily bulletin board
│   │   ├── TeamHistory.tsx       # `/team/:teamId/history` Grouped date history
│   │   └── Profile.tsx           # `/profile` User profile settings
│   ├── App.tsx                   # Application routes
│   ├── index.css                 # Tailwind CSS imports & tabular numeral rules
│   └── main.tsx                  # React DOM entry point
```

## 2. Environment Variables (`.env`)

Copy `.env.example` to `.env`:

```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-public-anon-key"
```

*Note: Never expose a Supabase `service_role` key in the frontend.*

## 3. Supabase Setup Instructions

1. Create a new project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Copy and run the contents of `supabase/schema.sql`. This creates:
   - `profiles` (linked to `auth.users` with an automatic signup trigger)
   - `teams` (`id`, `name`, `description`, `invite_code`, `owner_id`, `created_at`)
   - `team_members` (`id`, `team_id`, `user_id`, `role`, `joined_at`)
   - `standup_updates` (`id`, `team_id`, `user_id`, `update_date`, `worked_on`, `next_plan`, `blockers`, `created_at`, `updated_at`) with `UNIQUE(team_id, user_id, update_date)`
   - All **Row Level Security (RLS)** policies
   - **Supabase Realtime** publication for `standup_updates`
4. Install dependencies and start the development server:
   ```bash
   npm install
   npm run dev
   ```

## 4. Seed / Demo Data Instructions

- Sign in via `/login`.
- On `/teams`, click **"Load Demo Team & Sample Updates"** to automatically create a sample engineering team (**Core Product Engineering**) populated with teammates (**Harsh**, **Rahul**, **Priya**, and **Maya**) and multi-day updates.
- Open the team board and click **"Simulate Teammate Live Post"** to see a live `INSERT`/`UPDATE` arrive over Realtime without refreshing the page.
