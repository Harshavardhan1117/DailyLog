import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';

/**
 * Landing page (/) for Team Collaboration.
 * Showcases Daily Standups, Realtime Group Chat, and Team History.
 */
export function Landing() {
  const { user } = useAuth();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-16">
      {/* Hero + Workspace Preview */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6 space-y-6 pt-2">
          <div className="text-xs font-medium text-slate-500">
            Daily Standups · Realtime Group Chat · Team History
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight [text-wrap:balance]">
            Stay aligned with your team. Share daily updates and chat in real time.
          </h1>

          <p className="text-base text-slate-600 leading-relaxed max-w-xl">
            Team Collaboration is a simple team workspace that combines structured
            three-question daily standups, realtime group chat, team member
            visibility, and update history in one clean place.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to={user ? '/teams' : '/login'}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <span>{user ? 'Open My Teams' : 'Get Started'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            {!user && (
              <Link
                to="/login"
                className="px-5 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
              >
                Login
              </Link>
            )}
          </div>

          {/* Core Features Summary */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs">
            <div>
              <div className="font-semibold text-slate-900">Daily Standups</div>
              <p className="mt-1 text-slate-500 leading-relaxed">
                Know what everyone is working on and spot blockers early.
              </p>
            </div>
            <div>
              <div className="font-semibold text-slate-900">Realtime Chat</div>
              <p className="mt-1 text-slate-500 leading-relaxed">
                Talk with your team instantly in one shared group chat room.
              </p>
            </div>
            <div>
              <div className="font-semibold text-slate-900">Team History</div>
              <p className="mt-1 text-slate-500 leading-relaxed">
                Browse previous standup updates grouped by date anytime.
              </p>
            </div>
          </div>
        </div>

        {/* Workspace Preview Card */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Core Product Team
              </h2>
              <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                6 Members · 5 Posted · 1 Missing · 1 Blocker
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <span>Standup</span>
              <span aria-hidden="true">·</span>
              <span>Chat</span>
              <span aria-hidden="true">·</span>
              <span>History</span>
            </div>
          </div>

          <div className="space-y-3.5">
            {/* Sample Standup Card: Harsh */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-[11px]">
                    HA
                  </div>
                  <span className="font-bold text-slate-900 text-sm">Harsh</span>
                </div>
                <span className="text-slate-500 font-mono tabular-nums">2:10 PM</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div>
                  <div className="font-semibold text-slate-500">Worked on</div>
                  <p className="text-slate-900 mt-0.5">Completed the DBMS schema.</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-500">Next</div>
                  <p className="text-slate-900 mt-0.5">Build the dashboard.</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-500">Blocker</div>
                  <p className="text-slate-600 mt-0.5">None.</p>
                </div>
              </div>
            </div>

            {/* Sample Standup Card: Rahul */}
            <div className="border border-red-300 border-l-4 border-l-red-600 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-[11px]">
                    RA
                  </div>
                  <span className="font-bold text-slate-900 text-sm">Rahul</span>
                  <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                    <span aria-hidden="true">·</span>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Blocker</span>
                  </span>
                </div>
                <span className="text-slate-500 font-mono tabular-nums">1:45 PM</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div>
                  <div className="font-semibold text-slate-500">Worked on</div>
                  <p className="text-slate-900 mt-0.5">Fixed authentication.</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-500">Next</div>
                  <p className="text-slate-900 mt-0.5">Testing.</p>
                </div>
                <div>
                  <div className="font-semibold text-red-600">Blocker</div>
                  <p className="text-red-700 font-medium mt-0.5">
                    Waiting for API access.
                  </p>
                </div>
              </div>
            </div>

            {/* Sample Team Chat Preview */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2 text-xs">
              <div className="font-semibold text-slate-700">
                Realtime Group Chat Preview
              </div>
              <div className="space-y-1.5 text-slate-700">
                <p>
                  <strong className="text-slate-900">Rahul:</strong> Hey, has everyone finished the presentation?{' '}
                  <span className="text-slate-400 font-mono">10:14 AM</span>
                </p>
                <p>
                  <strong className="text-slate-900">Harsh:</strong> Almost. I&apos;m fixing the dashboard now.{' '}
                  <span className="text-slate-400 font-mono">10:15 AM</span>
                </p>
                <p>
                  <strong className="text-slate-900">Ananya:</strong> I&apos;ll finish the slides in 20 minutes.{' '}
                  <span className="text-slate-400 font-mono">10:16 AM</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
