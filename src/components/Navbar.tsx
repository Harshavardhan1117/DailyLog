import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.tsx';

interface NavbarProps {
  onOpenSqlDocs: () => void;
}

/**
 * Main navigation bar using the product name "Team Collaboration" everywhere.
 * Layout:
 * ┌──────────────────────────────────────────────────────┐
 * │ Team Collaboration    My Teams   Tasks   Profile     │
 * └──────────────────────────────────────────────────────┘
 */
export function Navbar({ onOpenSqlDocs }: NavbarProps) {
  const { user, profile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand title ("Team Collaboration") */}
        <Link
          to={user ? '/teams' : '/'}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Team Collaboration
        </Link>

        {/* Zone 2: Main navigation links (My Teams | Tasks | Profile) */}
        <nav className="flex items-center gap-5 sm:gap-7 text-sm font-medium text-slate-600">
          {user ? (
            <>
              <Link
                to="/teams"
                className={`whitespace-nowrap transition-colors hover:text-slate-900 ${
                  isActive('/teams') || isActive('/team')
                    ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-slate-900'
                    : ''
                }`}
              >
                My Teams
              </Link>
              <Link
                to="/tasks"
                className={`whitespace-nowrap transition-colors hover:text-slate-900 ${
                  isActive('/tasks')
                    ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-slate-900'
                    : ''
                }`}
              >
                Tasks
              </Link>
              <Link
                to="/profile"
                className={`whitespace-nowrap transition-colors hover:text-slate-900 ${
                  isActive('/profile')
                    ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-slate-900'
                    : ''
                }`}
              >
                Profile
              </Link>
            </>
          ) : (
            <Link
              to="/"
              className={`whitespace-nowrap transition-colors hover:text-slate-900 ${
                location.pathname === '/'
                  ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-slate-900'
                  : ''
              }`}
            >
              Overview
            </Link>
          )}
          <button
            type="button"
            onClick={onOpenSqlDocs}
            className="hidden md:inline-block whitespace-nowrap text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            SQL & RLS Guide
          </button>
        </nav>

        {/* Zone 3: User actions (Logout / Login) */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <>
              <Link
                to="/profile"
                className="hidden sm:inline-block text-xs text-slate-600 hover:text-slate-900 truncate max-w-[160px]"
                title={profile?.fullName || user.email || ''}
              >
                {profile?.fullName || user.email}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
