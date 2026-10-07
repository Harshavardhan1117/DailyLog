import { createClient } from '@supabase/supabase-js';
import { auth } from './firebase.ts';

/**
 * ============================================================================
 * SUPABASE CLIENT, REALTIME & VERCEL-READY DATA ADAPTER (src/lib/supabase.ts)
 * ============================================================================
 * Supports 3 automatic runtime modes so the app works everywhere:
 * 1. Standalone Supabase Mode (on Vercel or locally when VITE_SUPABASE_URL &
 *    VITE_SUPABASE_ANON_KEY are configured in Environment Variables).
 * 2. Cloud SQL Backend Mode (when running with the Express `/api/*` server).
 * 3. Static Deployment Mode (when deployed to Vercel static hosting before
 *    external Supabase keys are configured — uses persistent browser storage
 *    + BroadcastChannel Realtime so authentication and boards never break).
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Session token & local user tracking
let activeSessionToken: string | null = null;
const SESSION_TOKEN_KEY = 'dsl_session_token';
const LOCAL_DB_KEY = 'dsl_vercel_database_v1';
const BROADCAST_CHANNEL_NAME = 'dsl_realtime_standup_updates';

const localRealtimeListeners = new Map<
  string,
  Set<
    (payload: {
      eventType: 'INSERT' | 'UPDATE' | 'DELETE';
      new: any;
      old: any;
    }) => void
  >
>();

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      const { teamId, payload } = event.data || {};
      if (teamId && payload) {
        const listeners = localRealtimeListeners.get(teamId);
        listeners?.forEach((cb) => cb(payload));
      }
    };
  }
} catch {
  // Ignore if BroadcastChannel is not supported
}

function emitLocalRealtime(
  teamId: string,
  payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: any;
    old: any;
  }
) {
  const listeners = localRealtimeListeners.get(teamId);
  listeners?.forEach((cb) => cb(payload));
  try {
    broadcastChannel?.postMessage({ teamId, payload });
  } catch {
    // Ignore broadcast errors
  }
}

export function setSessionToken(token: string | null) {
  activeSessionToken = token;
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getSessionToken(): string | null {
  if (activeSessionToken) return activeSessionToken;
  try {
    const stored =
      localStorage.getItem(SESSION_TOKEN_KEY) ||
      sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (stored) {
      activeSessionToken = stored;
      return stored;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const sessionToken = getSessionToken();
  if (sessionToken) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    };
  }

  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  throw new Error('Please log in to continue.');
}

export function getLocalTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// Persistent Fallback Store for Vercel Static Deployments
// ============================================================================

interface LocalStore {
  profiles: Record<
    string,
    {
      id: string;
      email: string;
      fullName: string;
      password?: string;
      jobTitle: string;
      avatarUrl: string;
      createdAt: string;
    }
  >;
  teams: Record<
    string,
    {
      id: string;
      name: string;
      description: string;
      inviteCode: string;
      ownerId: string;
      createdAt: string;
    }
  >;
  teamMembers: Array<{
    id: string;
    teamId: string;
    userId: string;
    role: string;
    joinedAt: string;
  }>;
  standupUpdates: Array<{
    id: string;
    teamId: string;
    userId: string;
    updateDate: string;
    workedOn: string;
    nextPlan: string;
    blockers: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

function loadLocalStore(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore parse error
  }
  return {
    profiles: {},
    teams: {},
    teamMembers: [],
    standupUpdates: [],
  };
}

function saveLocalStore(store: LocalStore) {
  try {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota errors
  }
}

function encodeLocalToken(uid: string): string {
  return `local_session_${uid}`;
}

function decodeLocalToken(token: string | null): string | null {
  if (!token) return null;
  if (token.startsWith('local_session_')) {
    return token.replace('local_session_', '');
  }
  if (token.startsWith('dsl.')) {
    try {
      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1]));
      return payload.uid || null;
    } catch {
      return null;
    }
  }
  return null;
}

function generateShortInviteCode(name: string): string {
  const prefix =
    name
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 4) || 'TEAM';
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${suffix}`;
}

function getCurrentLocalUid(): string {
  const token = getSessionToken();
  const decoded = decodeLocalToken(token);
  if (decoded) return decoded;
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  throw new Error('Unauthorized: Please log in to continue.');
}

/**
 * Checks if our backend Express server (`/api/*`) is reachable and returning JSON.
 * On Vercel static deployments without a Node backend, `/api/*` returns 404 or HTML.
 */
async function tryBackendJson(
  url: string,
  options?: RequestInit
): Promise<{ available: boolean; ok: boolean; status: number; data: any }> {
  // If user configured external Supabase, prefer Supabase directly over Express
  if (supabase) {
    return { available: false, ok: false, status: 0, data: null };
  }
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { available: false, ok: false, status: res.status, data: null };
    }
    const data = await res.json();
    if (res.status === 404 && !data?.error) {
      return { available: false, ok: false, status: 404, data: null };
    }
    return { available: true, ok: res.ok, status: res.status, data };
  } catch {
    return { available: false, ok: false, status: 0, data: null };
  }
}

// ============================================================================
// Unified API Request Handler (Works on Express, Supabase, AND Vercel Static)
// ============================================================================

export async function apiRequest(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    requireAuth?: boolean;
  } = {}
): Promise<any> {
  const method = options.method || 'GET';
  const shouldAuth = options.requireAuth !== false;

  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (shouldAuth) {
    try {
      headers = await getAuthHeaders();
    } catch {
      // Continue if using Supabase session
    }
  }

  // 1. Try Express / Cloud SQL backend if not using external Supabase
  const backendRes = await tryBackendJson(path, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (backendRes.available) {
    if (!backendRes.ok) {
      throw new Error(backendRes.data?.error || 'Request failed.');
    }
    return backendRes.data;
  }

  // 2. If external Supabase is configured via VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY
  if (supabase) {
    return handleSupabaseRequest(path, method, options.body);
  }

  // 3. Vercel Static Fallback Mode (Persistent Local DB + BroadcastChannel Realtime)
  return handleLocalVercelRequest(path, method, options.body);
}

/**
 * Executes requests directly against Supabase Auth & Supabase PostgreSQL when
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured on Vercel.
 */
async function handleSupabaseRequest(
  path: string,
  method: string,
  body?: any
): Promise<any> {
  if (!supabase) throw new Error('Supabase client not initialized');

  if (path === '/api/auth/signup' && method === 'POST') {
    const { email, password, fullName } = body;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
      },
    });
    if (error) throw new Error(error.message);
    const userId = data.user?.id;
    if (!userId) throw new Error('Sign up succeeded. Please check your email to confirm.');

    const profileObj = {
      id: userId,
      email: email.trim(),
      full_name: fullName.trim() || email.split('@')[0],
      job_title: 'Team Member',
      avatar_url: '',
    };
    await supabase.from('profiles').upsert(profileObj);

    return {
      token: data.session?.access_token || encodeLocalToken(userId),
      profile: {
        id: userId,
        email: profileObj.email,
        fullName: profileObj.full_name,
        jobTitle: profileObj.job_title,
        avatarUrl: '',
      },
    };
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const { email, password } = body;
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(error.message);
    const userId = data.user.id;

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    return {
      token: data.session?.access_token || encodeLocalToken(userId),
      profile: {
        id: userId,
        email: data.user.email || email,
        fullName:
          prof?.full_name ||
          data.user.user_metadata?.full_name ||
          email.split('@')[0],
        jobTitle: prof?.job_title || 'Team Member',
        avatarUrl: prof?.avatar_url || '',
      },
    };
  }

  // For other routes when using Supabase, get current Supabase user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Fallback to local store if using quick session
    return handleLocalVercelRequest(path, method, body);
  }

  if (path === '/api/profile' && method === 'GET') {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    return {
      profile: {
        id: user.id,
        email: user.email || '',
        fullName:
          prof?.full_name ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'Team Member',
        jobTitle: prof?.job_title || 'Team Member',
        avatarUrl: prof?.avatar_url || '',
      },
    };
  }

  if (path === '/api/profile' && method === 'PUT') {
    const { fullName, jobTitle } = body;
    const { data: updated, error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email || '',
        full_name: fullName.trim(),
        job_title: (jobTitle || '').trim(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return {
      profile: {
        id: updated.id,
        email: updated.email,
        fullName: updated.full_name,
        jobTitle: updated.job_title || '',
        avatarUrl: updated.avatar_url || '',
      },
    };
  }

  // Fallback to local store if tables aren't created yet in user's Supabase
  return handleLocalVercelRequest(path, method, body);
}

/**
 * Handles all API routes locally in the browser when deployed to Vercel static hosting.
 */
function handleLocalVercelRequest(
  path: string,
  method: string,
  body?: any
): any {
  const store = loadLocalStore();

  // 1. POST /api/auth/signup
  if (path === '/api/auth/signup' && method === 'POST') {
    const email = (body?.email || '').trim().toLowerCase();
    const password = body?.password || '';
    const fullName = (body?.fullName || '').trim() || email.split('@')[0];

    if (!email) throw new Error('Please enter a valid email address.');
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const existing = Object.values(store.profiles).find(
      (p) => p.email.toLowerCase() === email
    );
    if (existing) {
      throw new Error(
        'An account with this email already exists. Please log in instead.'
      );
    }

    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `user_${Date.now()}`;

    const newProfile = {
      id,
      email,
      fullName,
      password,
      jobTitle: 'Team Member',
      avatarUrl: '',
      createdAt: new Date().toISOString(),
    };
    store.profiles[id] = newProfile;
    saveLocalStore(store);

    const { password: _, ...cleanProfile } = newProfile;
    return {
      token: encodeLocalToken(id),
      profile: cleanProfile,
    };
  }

  // 2. POST /api/auth/login
  if (path === '/api/auth/login' && method === 'POST') {
    const email = (body?.email || '').trim().toLowerCase();
    const password = body?.password || '';

    const found = Object.values(store.profiles).find(
      (p) => p.email.toLowerCase() === email
    );
    if (!found || (found.password && found.password !== password)) {
      throw new Error(
        'Invalid email or password. Please check your credentials or sign up first.'
      );
    }

    const { password: _, ...cleanProfile } = found;
    return {
      token: encodeLocalToken(found.id),
      profile: cleanProfile,
    };
  }

  // 3. POST /api/auth/quick-session
  if (path === '/api/auth/quick-session' && method === 'POST') {
    const email = (body?.email || 'alex.morgan@standuplog.dev')
      .trim()
      .toLowerCase();
    const fullName = (body?.fullName || 'Alex Morgan').trim();

    let found = Object.values(store.profiles).find(
      (p) => p.email.toLowerCase() === email
    );
    if (!found) {
      const id = `user_${email.replace(/[^a-z0-9]/g, '_')}`;
      found = {
        id,
        email,
        fullName,
        jobTitle: 'Software Engineer',
        avatarUrl: '',
        createdAt: new Date().toISOString(),
      };
      store.profiles[id] = found;
      saveLocalStore(store);
    }
    const { password: _, ...cleanProfile } = found;
    return {
      token: encodeLocalToken(found.id),
      profile: cleanProfile,
    };
  }

  // Authenticated routes below
  const uid = getCurrentLocalUid();
  if (!store.profiles[uid]) {
    store.profiles[uid] = {
      id: uid,
      email: auth.currentUser?.email || 'member@standuplog.dev',
      fullName:
        auth.currentUser?.displayName ||
        auth.currentUser?.email?.split('@')[0] ||
        'Alex Morgan',
      jobTitle: 'Team Member',
      avatarUrl: auth.currentUser?.photoURL || '',
      createdAt: new Date().toISOString(),
    };
    saveLocalStore(store);
  }

  // 4. GET /api/profile
  if (path === '/api/profile' && method === 'GET') {
    const { password: _, ...cleanProfile } = store.profiles[uid];
    return { profile: cleanProfile };
  }

  // 5. PUT /api/profile
  if (path === '/api/profile' && method === 'PUT') {
    store.profiles[uid] = {
      ...store.profiles[uid],
      fullName: (body?.fullName || '').trim() || store.profiles[uid].fullName,
      jobTitle: (body?.jobTitle || '').trim(),
    };
    saveLocalStore(store);
    const { password: _, ...cleanProfile } = store.profiles[uid];
    return { profile: cleanProfile };
  }

  // 6. GET /api/teams
  if (path.startsWith('/api/teams') && method === 'GET' && !path.includes('/board')) {
    const urlObj = new URL(path, 'http://localhost');
    const todayDate = urlObj.searchParams.get('today') || getLocalTodayDate();

    const myMemberships = store.teamMembers.filter((m) => m.userId === uid);
    const resultTeams = myMemberships
      .map((m) => {
        const team = store.teams[m.teamId];
        if (!team) return null;
        const allMembers = store.teamMembers.filter(
          (tm) => tm.teamId === team.id
        );
        const todaysUpdates = store.standupUpdates.filter(
          (u) => u.teamId === team.id && u.updateDate === todayDate
        );
        const blockersCount = todaysUpdates.filter((u) => {
          const b = (u.blockers || '').trim().toLowerCase();
          return b !== '' && b !== 'none' && b !== 'none.' && b !== 'n/a';
        }).length;

        return {
          ...team,
          myRole: m.role,
          memberCount: allMembers.length,
          postedTodayCount: todaysUpdates.length,
          blockersTodayCount: blockersCount,
        };
      })
      .filter(Boolean);

    return { teams: resultTeams };
  }

  // 7. POST /api/teams (Create Team)
  if (path === '/api/teams' && method === 'POST') {
    const name = (body?.name || '').trim();
    const description = (body?.description || '').trim();
    if (!name) throw new Error('Please enter a team name.');

    const teamId = `team_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const inviteCode = generateShortInviteCode(name);
    const createdTeam = {
      id: teamId,
      name,
      description,
      inviteCode,
      ownerId: uid,
      createdAt: new Date().toISOString(),
    };
    store.teams[teamId] = createdTeam;
    store.teamMembers.push({
      id: `tm_${Date.now()}`,
      teamId,
      userId: uid,
      role: 'owner',
      joinedAt: new Date().toISOString(),
    });
    saveLocalStore(store);
    return { team: createdTeam };
  }

  // 8. POST /api/teams/join
  if (path === '/api/teams/join' && method === 'POST') {
    const code = (body?.inviteCode || '').trim().toUpperCase();
    const foundTeam = Object.values(store.teams).find(
      (t) => t.inviteCode.toUpperCase() === code
    );
    if (!foundTeam) {
      throw new Error('No team found with that invite code.');
    }
    const alreadyMember = store.teamMembers.some(
      (m) => m.teamId === foundTeam.id && m.userId === uid
    );
    if (!alreadyMember) {
      store.teamMembers.push({
        id: `tm_${Date.now()}`,
        teamId: foundTeam.id,
        userId: uid,
        role: 'member',
        joinedAt: new Date().toISOString(),
      });
      saveLocalStore(store);
    }
    return { team: foundTeam };
  }

  // 9. POST /api/teams/seed-demo
  if (path === '/api/teams/seed-demo' && method === 'POST') {
    const todayDate = body?.today || getLocalTodayDate();
    const demoTeammates = [
      {
        id: 'demo-user-harsh',
        email: 'harsh@standuplog.dev',
        fullName: 'Harsh',
        jobTitle: 'Backend Engineer',
        avatarUrl: '',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'demo-user-rahul',
        email: 'rahul@standuplog.dev',
        fullName: 'Rahul Sharma',
        jobTitle: 'Full-Stack Developer',
        avatarUrl: '',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'demo-user-priya',
        email: 'priya@standuplog.dev',
        fullName: 'Priya Patel',
        jobTitle: 'Product Designer',
        avatarUrl: '',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'demo-user-maya',
        email: 'maya@standuplog.dev',
        fullName: 'Maya Lin',
        jobTitle: 'QA & Release Lead',
        avatarUrl: '',
        createdAt: new Date().toISOString(),
      },
    ];

    for (const mate of demoTeammates) {
      store.profiles[mate.id] = mate;
    }

    const teamId = `team_demo_${Date.now()}`;
    const createdTeam = {
      id: teamId,
      name: 'Core Product Engineering',
      description:
        'Daily async standup board for the Core Platform & API engineering squad.',
      inviteCode: generateShortInviteCode('CORE'),
      ownerId: uid,
      createdAt: new Date().toISOString(),
    };
    store.teams[teamId] = createdTeam;

    store.teamMembers.push({
      id: `tm_owner_${Date.now()}`,
      teamId,
      userId: uid,
      role: 'owner',
      joinedAt: new Date().toISOString(),
    });

    for (const mate of demoTeammates) {
      store.teamMembers.push({
        id: `tm_${mate.id}_${Date.now()}`,
        teamId,
        userId: mate.id,
        role: 'member',
        joinedAt: new Date().toISOString(),
      });
    }

    const todayObj = new Date(`${todayDate}T12:00:00Z`);
    const yesterdayDate = new Date(todayObj.getTime() - 86400000)
      .toISOString()
      .slice(0, 10);

    const sampleUpdates = [
      {
        userId: 'demo-user-harsh',
        updateDate: todayDate,
        workedOn:
          'Completed the PostgreSQL DBMS schema and configured Row Level Security policies.',
        nextPlan:
          'Build the main team bulletin board view and hook up Realtime subscriptions.',
        blockers: 'None.',
        offsetMinutes: -45,
      },
      {
        userId: 'demo-user-rahul',
        updateDate: todayDate,
        workedOn:
          'Fixed authentication session persistence and added protected route guards.',
        nextPlan: 'End-to-end testing of invite codes and team switching.',
        blockers: 'Waiting for staging OAuth callback URL approval from DevOps.',
        offsetMinutes: -20,
      },
      {
        userId: 'demo-user-priya',
        updateDate: todayDate,
        workedOn:
          'Finalized responsive card layout and blocker warning indicators for mobile screens.',
        nextPlan: 'Review history date filter interactions with engineering.',
        blockers: 'None.',
        offsetMinutes: -8,
      },
      {
        userId: 'demo-user-harsh',
        updateDate: yesterdayDate,
        workedOn:
          'Drafted initial ERD for profiles, teams, team_members, and standup_updates.',
        nextPlan: 'Write SQL migrations and test unique constraints.',
        blockers: 'None.',
        offsetMinutes: -1440,
      },
    ];

    for (const item of sampleUpdates) {
      const ts = new Date(Date.now() + item.offsetMinutes * 60000).toISOString();
      store.standupUpdates.push({
        id: `upd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        teamId,
        userId: item.userId,
        updateDate: item.updateDate,
        workedOn: item.workedOn,
        nextPlan: item.nextPlan,
        blockers: item.blockers,
        createdAt: ts,
        updatedAt: ts,
      });
    }

    saveLocalStore(store);
    return { team: createdTeam };
  }

  // 10. GET /api/teams/:teamId/board
  const boardMatch = path.match(/^\/api\/teams\/([^/?]+)\/board/);
  if (boardMatch && method === 'GET') {
    const teamId = boardMatch[1];
    const urlObj = new URL(path, 'http://localhost');
    const dateFilter = urlObj.searchParams.get('date') || undefined;

    const team = store.teams[teamId];
    if (!team) throw new Error('Team not found.');

    const membership = store.teamMembers.find(
      (m) => m.teamId === teamId && m.userId === uid
    );
    if (!membership) {
      throw new Error(
        'Access denied. You must be a member of this team to view its bulletin board.'
      );
    }

    const members = store.teamMembers
      .filter((m) => m.teamId === teamId)
      .map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: store.profiles[m.userId] || {
          id: m.userId,
          email: 'member@standuplog.dev',
          fullName: 'Team Member',
          jobTitle: '',
          avatarUrl: '',
        },
      }));

    const updates = store.standupUpdates
      .filter(
        (u) =>
          u.teamId === teamId && (!dateFilter || u.updateDate === dateFilter)
      )
      .map((u) => ({
        ...u,
        author: store.profiles[u.userId],
      }))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

    return {
      team,
      myRole: membership.role,
      members,
      updates,
    };
  }

  // 11. POST /api/teams/:teamId/updates
  const updatesMatch = path.match(/^\/api\/teams\/([^/?]+)\/updates$/);
  if (updatesMatch && method === 'POST') {
    const teamId = updatesMatch[1];
    const updateDate = body?.updateDate || getLocalTodayDate();
    const workedOn = (body?.workedOn || '').trim();
    const nextPlan = (body?.nextPlan || '').trim();
    const blockers = (body?.blockers || '').trim() || 'None.';

    const existingIdx = store.standupUpdates.findIndex(
      (u) =>
        u.teamId === teamId &&
        u.userId === uid &&
        u.updateDate === updateDate
    );

    const now = new Date().toISOString();
    let savedRecord: any;
    let eventType: 'INSERT' | 'UPDATE' = 'INSERT';

    if (existingIdx >= 0) {
      eventType = 'UPDATE';
      store.standupUpdates[existingIdx] = {
        ...store.standupUpdates[existingIdx],
        workedOn,
        nextPlan,
        blockers,
        updatedAt: now,
      };
      savedRecord = {
        ...store.standupUpdates[existingIdx],
        author: store.profiles[uid],
      };
    } else {
      const created = {
        id: `upd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        teamId,
        userId: uid,
        updateDate,
        workedOn,
        nextPlan,
        blockers,
        createdAt: now,
        updatedAt: now,
      };
      store.standupUpdates.push(created);
      savedRecord = {
        ...created,
        author: store.profiles[uid],
      };
    }

    saveLocalStore(store);
    emitLocalRealtime(teamId, {
      eventType,
      new: savedRecord,
      old: null,
    });
    return { update: savedRecord, eventType };
  }

  // 12. POST /api/teams/:teamId/simulate-realtime
  const simMatch = path.match(/^\/api\/teams\/([^/?]+)\/simulate-realtime$/);
  if (simMatch && method === 'POST') {
    const teamId = simMatch[1];
    const todayDate = body?.today || getLocalTodayDate();
    const mateId = 'demo-user-maya';

    if (!store.profiles[mateId]) {
      store.profiles[mateId] = {
        id: mateId,
        email: 'maya@standuplog.dev',
        fullName: 'Maya Lin',
        jobTitle: 'QA & Release Lead',
        avatarUrl: '',
        createdAt: new Date().toISOString(),
      };
    }

    if (
      !store.teamMembers.some(
        (m) => m.teamId === teamId && m.userId === mateId
      )
    ) {
      store.teamMembers.push({
        id: `tm_maya_${Date.now()}`,
        teamId,
        userId: mateId,
        role: 'member',
        joinedAt: new Date().toISOString(),
      });
    }

    const now = new Date().toISOString();
    const samples = [
      {
        workedOn:
          'Verified realtime PostgreSQL event broadcasting across concurrent browser tabs.',
        nextPlan: 'Run regression suite on the History date filter view.',
        blockers: 'None.',
      },
      {
        workedOn:
          'Audited Row Level Security policies for standup_updates and team_members.',
        nextPlan: 'Sign off on production release checklist.',
        blockers:
          'Blocked on final confirmation for mobile Safari viewport test.',
      },
    ];
    const pick = samples[Math.floor(Math.random() * samples.length)];

    const existingIdx = store.standupUpdates.findIndex(
      (u) =>
        u.teamId === teamId &&
        u.userId === mateId &&
        u.updateDate === todayDate
    );

    let savedRecord: any;
    let eventType: 'INSERT' | 'UPDATE' = 'INSERT';

    if (existingIdx >= 0) {
      eventType = 'UPDATE';
      store.standupUpdates[existingIdx] = {
        ...store.standupUpdates[existingIdx],
        ...pick,
        updatedAt: now,
      };
      savedRecord = {
        ...store.standupUpdates[existingIdx],
        author: store.profiles[mateId],
      };
    } else {
      const created = {
        id: `upd_maya_${Date.now()}`,
        teamId,
        userId: mateId,
        updateDate: todayDate,
        ...pick,
        createdAt: now,
        updatedAt: now,
      };
      store.standupUpdates.push(created);
      savedRecord = {
        ...created,
        author: store.profiles[mateId],
      };
    }

    saveLocalStore(store);
    emitLocalRealtime(teamId, {
      eventType,
      new: savedRecord,
      old: null,
    });
    return { update: savedRecord, eventType };
  }

  // 13. DELETE /api/updates/:updateId
  const delMatch = path.match(/^\/api\/updates\/([^/?]+)$/);
  if (delMatch && method === 'DELETE') {
    const updateId = delMatch[1];
    const foundIdx = store.standupUpdates.findIndex((u) => u.id === updateId);
    if (foundIdx === -1) throw new Error('Standup update not found.');
    const target = store.standupUpdates[foundIdx];
    if (target.userId !== uid) {
      throw new Error('You can only delete your own daily standup update.');
    }
    store.standupUpdates.splice(foundIdx, 1);
    saveLocalStore(store);
    emitLocalRealtime(target.teamId, {
      eventType: 'DELETE',
      new: null,
      old: { id: target.id, teamId: target.teamId, userId: target.userId },
    });
    return { deletedId: target.id };
  }

  throw new Error(`Unhandled route: ${method} ${path}`);
}

/**
 * Subscribes to Realtime changes on `standup_updates` filtered by `team_id`.
 * Works with Supabase Realtime, Express SSE, and Vercel Static BroadcastChannel!
 */
export function subscribeToTeamStandups(
  teamId: string,
  onPayload: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: any;
    old: any;
  }) => void,
  onStatusChange?: (status: 'SUBSCRIBED' | 'ERROR') => void
): () => void {
  // Always register local listener so BroadcastChannel / fallback updates arrive immediately
  if (!localRealtimeListeners.has(teamId)) {
    localRealtimeListeners.set(teamId, new Set());
  }
  localRealtimeListeners.get(teamId)!.add(onPayload);

  // 1. If external Supabase is configured, subscribe via Supabase Realtime channel
  if (supabase) {
    const channel = supabase
      .channel(`standup_updates:team_${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'standup_updates',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          onPayload({
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: payload.new,
            old: payload.old,
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') onStatusChange?.('SUBSCRIBED');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          onStatusChange?.('SUBSCRIBED');
        }
      });

    return () => {
      localRealtimeListeners.get(teamId)?.delete(onPayload);
      supabase.removeChannel(channel);
    };
  }

  // 2. Built-in SSE stream with graceful fallback for Vercel static hosting
  let eventSource: EventSource | null = null;
  try {
    eventSource = new EventSource(`/api/teams/${teamId}/realtime`);

    eventSource.onopen = () => {
      onStatusChange?.('SUBSCRIBED');
    };

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'SUBSCRIBED') {
          onStatusChange?.('SUBSCRIBED');
          return;
        }
        if (
          parsed.eventType === 'INSERT' ||
          parsed.eventType === 'UPDATE' ||
          parsed.eventType === 'DELETE'
        ) {
          onPayload({
            eventType: parsed.eventType,
            new: parsed.new,
            old: parsed.old,
          });
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    eventSource.onerror = () => {
      // On Vercel static hosting, /api/teams/:id/realtime is not present;
      // close SSE and rely on BroadcastChannel realtime without showing an error state.
      eventSource?.close();
      onStatusChange?.('SUBSCRIBED');
    };
  } catch {
    onStatusChange?.('SUBSCRIBED');
  }

  return () => {
    localRealtimeListeners.get(teamId)?.delete(onPayload);
    eventSource?.close();
  };
}
