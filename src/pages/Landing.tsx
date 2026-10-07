import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.tsx';

/**
 * Landing page (/) introducing Daily Standup Log as a clean team bulletin board.
 */
export function Landing() {
  const { user } = useAuth();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-16">
      {/* Hero + Live Bulletin Board Preview */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-6 space-y-6 pt-2">
          <div className="text-xs font-medium text-slate-500">
            Async Daily Standups · Real-Time Team Bulletin Board
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight [text-wrap:balance]">
            Keep your team aligned without another morning meeting.
          </h1>

          <p className="text-base text-slate-600 leading-relaxed max-w-xl">
            Daily Standup Log is a calm, beginner-friendly team bulletin board.
            Every member answers three simple questions once a day, surfaces
            blockers immediately, and sees live updates from teammates as they
            arrive.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to={user ? '/teams' : '/login'}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <span>{user ? 'Open My Teams' : 'Get Started Free'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            {!user && (
              <Link
                to="/login"
                className="px-5 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
              >
                Sign In to Existing Team
              </Link>
            )}
          </div>

          {/* 3-Step Workflow Summary */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="font-semibold text-slate-900">01. Create or Join</div>
              <p className="mt-1 text-slate-500 leading-relaxed">
                Start a team board in seconds or join teammates with a short invite code.
              </p>
            </div>
            <div>
              <div className="font-semibold text-slate-900">02. Three Questions</div>
              <p className="mt-1 text-slate-500 leading-relaxed">
                Share what you worked on, what is next, and whether anything blocks you.
              </p>
            </div>
            <div>
              <div className="font-semibold text-slate-900">03. Live Visibility</div>
              <p className="mt-1 text-slate-500 leading-relaxed">
                Updates appear on the board in real time without refreshing the page.
              </p>
            </div>
          </div>
        </div>

        {/* Interactive-looking Bulletin Board Preview */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Core Product Engineering
              </h2>
              <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                6 members · 5 posted today · 1 missing · 1 blocker
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-700">
              Live Board
            </span>
          </div>

          <div className="space-y-4">
            {/* Sample Card 1: Harsh */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-[11px]">
                    HV
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

            {/* Sample Card 2: Rahul (with Blocker highlight) */}
            <div className="border border-red-300 border-l-4 border-l-red-600 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-[11px]">
                    RS
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
          </div>
        </div>
      </section>
    </div>
  );
}
