import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth.tsx';
import { apiRequest } from '../lib/supabase.ts';

/**
 * Profile settings page (/profile).
 * Allows users to edit Username, Avatar URL, and Basic profile information (Role/Title).
 */
export function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setAvatarUrl(profile.avatarUrl || '');
      setJobTitle(profile.jobTitle || '');
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);
    try {
      await apiRequest('/api/profile', {
        method: 'PUT',
        body: {
          fullName: fullName.trim(),
          avatarUrl: avatarUrl.trim(),
          jobTitle: jobTitle.trim(),
        },
      });
      await refreshProfile();
      setStatusMessage({
        type: 'success',
        text: 'Your profile has been updated.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to update profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Edit your username, avatar, and basic profile details shown across your teams.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        {statusMessage && (
          <div
            role="status"
            className={`p-3.5 rounded-lg text-xs font-medium border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={profile?.email || user?.email || ''}
            disabled
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-500 cursor-not-allowed"
          />
        </div>

        <div>
          <label
            htmlFor="profile-name"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Username / Full Name
          </label>
          <input
            id="profile-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g., Alex Morgan"
            required
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
          />
        </div>

        <div>
          <label
            htmlFor="profile-avatar"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Avatar URL{' '}
            <span className="text-slate-400 font-normal">
              (optional — initials are used if blank)
            </span>
          </label>
          <input
            id="profile-avatar"
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
          />
        </div>

        <div>
          <label
            htmlFor="profile-title"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Role / Basic Info{' '}
            <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="profile-title"
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g., Full-Stack Developer, Product Designer"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
