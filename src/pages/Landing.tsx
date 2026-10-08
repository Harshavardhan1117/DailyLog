import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckSquare,
  MessageSquare,
  Users,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';

/**
 * Landing page (/) introducing Team Collaboration:
 * 1. Daily Standup Log
 * 2. Realtime Group Chat
 * 3. Task Management
 * 4. Team Member Visibility & Update History
 */
export function Landing() {
  const { user } = useAuth();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-14">
      {/* Hero Section */}
      <section className="max-w-3xl space-y-5">
        <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
          TEAM COLLABORATION WORKSPACE · STANDUPS, CHAT &amp; TASKS
        </p>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12]">
          Daily standups, realtime group chat, and team tasks in one calm
          workspace.
        </h1>

        <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
          <strong>Team Collaboration</strong> helps small teams share structured
          daily status updates, surface blockers early, chat in real time, and
          track tasks across To Do, In Progress, and Completed without noisy
          project-management bloat.
        </p>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <Link
            to={user ? '/teams' : '/login'}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span>{user ? 'Open My Teams' : 'Get Started'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            to={user ? '/tasks' : '/login'}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            {user ? 'Open Tasks Board' : 'Sign In to Workspace'}
          </Link>
        </div>
      </section>

      {/* Interactive Workspace Preview */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Sample Workspace Preview — Core Product Team
            </h2>
            <p className="text-xs text-slate-500">
              Combine three-question standups, realtime team chat, and 3-column
              task management.
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-700">
            ● Realtime Sync Enabled
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Column 1: Daily Standup Cards */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Daily Standup Log
            </div>

            <article className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Harsh</h3>
                  <p className="text-xs text-slate-500">Backend Engineer</p>
                </div>
                <span className="text-xs font-mono text-slate-500">2:10 PM</span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-500">
                    Worked on:{' '}
                  </span>
                  <span className="text-slate-900">
                    Completed the DBMS schema.
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Next: </span>
                  <span className="text-slate-900">Build the dashboard.</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">
                    Blocker:{' '}
                  </span>
                  <span className="text-slate-500">None.</span>
                </div>
              </div>
            </article>

            <article className="bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Rahul</h3>
                  <p className="text-xs text-slate-500">Full-Stack Developer</p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Blocker
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-500">
                    Worked on:{' '}
                  </span>
                  <span className="text-slate-900">Fixed authentication.</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Next: </span>
                  <span className="text-slate-900">Testing.</span>
                </div>
                <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/80 text-amber-950 font-medium">
                  Blocker: Waiting for API access.
                </div>
              </div>
            </article>
          </div>

          {/* Column 2: Realtime Group Chat */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              2. Realtime Group Chat
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-700" />
                  <span className="text-sm font-bold text-slate-900">
                    Team Chat
                  </span>
                </div>
                <span className="text-[11px] font-mono text-emerald-700">
                  Live
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="flex justify-between font-semibold text-slate-900 mb-0.5">
                    <span>Rahul</span>
                    <span className="font-mono text-[11px] text-slate-400">
                      10:12 AM
                    </span>
                  </div>
                  <p className="text-slate-700">
                    Hey, has everyone finished the presentation?
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="flex justify-between font-semibold text-slate-900 mb-0.5">
                    <span>Harsh</span>
                    <span className="font-mono text-[11px] text-slate-400">
                      10:13 AM
                    </span>
                  </div>
                  <p className="text-slate-700">
                    Almost. I&apos;m fixing the dashboard now.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="flex justify-between font-semibold text-slate-900 mb-0.5">
                    <span>Ananya</span>
                    <span className="font-mono text-[11px] text-slate-400">
                      10:14 AM
                    </span>
                  </div>
                  <p className="text-slate-700">
                    I&apos;ll finish the slides in 20 minutes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Task Management */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              3. Task Management
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-slate-700" />
                  <span className="text-sm font-bold text-slate-900">
                    Tasks (To Do · In Progress · Completed)
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      Fix login bug
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-300 rounded">
                      High
                    </span>
                  </div>
                  <p className="text-slate-600">
                    Assigned to: <strong>Rahul</strong> · Status:{' '}
                    <strong>To Do</strong>
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      Build dashboard
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 rounded">
                      In Progress
                    </span>
                  </div>
                  <p className="text-slate-600">
                    Assigned to: <strong>Harsh</strong> · Due: Apr 20
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-500 line-through">
                      Setup Supabase
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                      Completed
                    </span>
                  </div>
                  <p className="text-slate-600">
                    Assigned to: <strong>Harsh</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Feature Pillars */}
      <section className="grid grid-cols-1 sm:grid-cols-4 gap-5 pt-4 border-t border-slate-200">
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-slate-900">
            1. Daily Standup Log
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            One structured three-question update per member per day with clear
            blocker highlighting.
          </p>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-slate-900">
            2. Realtime Group Chat
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Dedicated chat room for each team with instant message delivery,
            editing, and deletion.
          </p>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-slate-900">
            3. Task Management
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Simple 3-column task board (To Do, In Progress, Completed) right
            next to My Teams.
          </p>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-700" />
            <span>4. Member Visibility &amp; History</span>
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            See who has updated today, who is missing, and filter past standups
            by date.
          </p>
        </div>
      </section>
    </div>
  );
}
