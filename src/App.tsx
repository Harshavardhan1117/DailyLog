/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.tsx';
import { Navbar } from './components/Navbar.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { SqlSetupModal } from './components/SqlSetupModal.tsx';
import { Landing } from './pages/Landing.tsx';
import { Login } from './pages/Login.tsx';
import { Teams } from './pages/Teams.tsx';
import { TeamBoard } from './pages/TeamBoard.tsx';
import { TeamHistory } from './pages/TeamHistory.tsx';
import { Profile } from './pages/Profile.tsx';

export default function App() {
  const [sqlModalOpen, setSqlModalOpen] = useState(false);

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
          <Navbar onOpenSqlDocs={() => setSqlModalOpen(true)} />

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/teams"
                element={
                  <ProtectedRoute>
                    <Teams />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/team/:teamId"
                element={
                  <ProtectedRoute>
                    <TeamBoard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/team/:teamId/history"
                element={
                  <ProtectedRoute>
                    <TeamHistory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <footer className="border-t border-slate-200 bg-white py-5">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <span>Daily Standup Log · Async Team Bulletin Board</span>
              <button
                type="button"
                onClick={() => setSqlModalOpen(true)}
                className="text-slate-600 hover:text-slate-900 underline underline-offset-4 cursor-pointer"
              >
                View Supabase SQL Schema, RLS Policies & Setup Instructions
              </button>
            </div>
          </footer>

          <SqlSetupModal
            isOpen={sqlModalOpen}
            onClose={() => setSqlModalOpen(false)}
          />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
