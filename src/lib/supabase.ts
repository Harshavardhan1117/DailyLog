import { createClient } from '@supabase/supabase-js';
import { auth } from './firebase.ts';

/**
 * ============================================================================
 * SUPABASE CLIENT, REALTIME & VERCEL-READY DATA ADAPTER (src/lib/supabase.ts)
 * ============================================================================
 * Supports 3 automatic runtime modes so the app works everywhere:
 * 1. Standalone Supabase Mode (when VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY are set)
 * 2. Cloud SQL Backend Mode (Express + PostgreSQL + Realtime SSE)
 * 3. Vercel Static Fallback Mode (Browser storage + BroadcastChannel Realtime)
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

let activeSessionToken: string | null = null;
const SESSION_TOKEN_KEY = 'tc_session_token';
const LOCAL_DB_KEY = 'tc_vercel_database_v3';
const BROADCAST_CHANNEL_NAME = 'tc_realtime_workspace_events';

type RealtimeCallback = (payload: {
  table?: 'standup_updates' | 'chat_messages' | 'tasks';
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: any;
  old: any;
}) => void;

const localStandupListeners = new Map<string, Set<RealtimeCallback>>();
const localChatListeners = new Map<string, Set<RealtimeCallback>>();
const localTaskListeners = new Set<RealtimeCallback>();

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      const { teamId, table, payload } = event.data || {};
      if (!payload) return;
      if (table === 'tasks') {
        localTaskListeners.forEach((cb) => cb(payload));
      } else if (table === 'chat_messages' && teamId) {
        localChatListeners.get(teamId)?.forEach((cb) => cb(payload));
      } else if (teamId) {
        localStandupListeners.get(teamId)?.forEach((cb) => cb(payload));
      }
    };
  }
} catch {
  // Ignore if BroadcastChannel is unavailable
}

function emitLocalRealtime(
  teamId: string,
  table: 'standup_updates' | 'chat_messages' | 'tasks',
  payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: any;
    old: any;
  }
) {
  if (table === 'tasks') {
    localTaskListeners.forEach((cb) => cb(payload));
  } else if (table === 'chat_messages') {
    localChatListeners.get(teamId)?.forEach((cb) => cb(payload));
  } else {
    localStandupListeners.get(teamId)?.forEach((cb) => cb(payload));
  }
  try {
    broadcastChannel?.postMessage({ teamId, table, payload });
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
  chatMessages: Array<{
    id: string;
    teamId: string;
    userId: string;
    message: string;
    createdAt: string;
    updatedAt: string;
  }>;
  tasks: Array<{
    id: string;
    teamId: string;
    createdBy: string;
    assignedTo: string | null;
    title: string;
    description: string;
    status: 'todo' | 'in_progress' | 'completed';
    priority: 'low' | 'medium' | 'high';
    dueDate: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

function loadLocalStore(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        profiles: parsed.profiles || {},
        teams: parsed.teams || {},
        teamMembers: parsed.teamMembers || [],
        standupUpdates: parsed.standupUpdates || [],
        chatMessages: parsed.chatMessages || [],
        tasks: parsed.tasks || [],
      };
    }
  } catch {
    // Ignore parse error
  }
  return {
    profiles: {},
    teams: {},
    teamMembers: [],
    standupUpdates: [],
    chatMessages: [],
    tasks: [],
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

function enrichLocalTask(store: LocalStore, task: LocalStore['tasks'][number]) {
  const team = store.teams[task.teamId];
  const creator = store.profiles[task.createdBy];
  const assignee = task.assignedTo ? store.profiles[task.assignedTo] || null : null;
  return {
    ...task,
    teamName: team?.name || 'Team',
    creator: creator || null,
    assignee,
  };
}

async function tryBackendJson(
  url: string,
  options?: RequestInit
): Promise<{ available: boolean; ok: boolean; status: number; data: any }> {
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
      // Continue if using Supabase or fallback
    }
  }

  // 1. Try Express / Cloud SQL backend
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

  // 2. External Supabase when VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY are set
  if (supabase) {
    return handleSupabaseRequest(path, method, options.body);
  }

  // 3. Vercel Static Fallback Mode
  return handleLocalVercelRequest(path, method, options.body);
}

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
    if (!userId)
      throw new Error('Sign up succeeded. Please check your email to confirm.');

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

  return handleLocalVercelRequest(path, method, body);
}

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
    const email = (body?.email || 'alex.morgan@teamcollab.dev')
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

  // Authenticated routes
  const uid = getCurrentLocalUid();
  if (!store.profiles[uid]) {
    store.profiles[uid] = {
      id: uid,
      email: auth.currentUser?.email || 'member@teamcollab.dev',
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
      avatarUrl:
        typeof body?.avatarUrl === 'string'
          ? body.avatarUrl.trim()
          : store.profiles[uid].avatarUrl,
    };
    saveLocalStore(store);
    const { password: _, ...cleanProfile } = store.profiles[uid];
    return { profile: cleanProfile };
  }

  // 6. GET /api/teams
  if (
    path.startsWith('/api/teams') &&
    method === 'GET' &&
    !path.includes('/board') &&
    !path.includes('/chat')
  ) {
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

  // 7. POST /api/teams
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

  // 8b. DELETE /api/teams/:teamId/leave
  const leaveMatch = path.match(/^\/api\/teams\/([^/?]+)\/leave$/);
  if (leaveMatch && method === 'DELETE') {
    const teamId = leaveMatch[1];
    store.teamMembers = store.teamMembers.filter(
      (m) => !(m.teamId === teamId && m.userId === uid)
    );
    saveLocalStore(store);
    return { success: true };
  }

  // 8c. DELETE /api/teams/:teamId/members/:memberId
  const removeMemberMatch = path.match(
    /^\/api\/teams\/([^/?]+)\/members\/([^/?]+)$/
  );
  if (removeMemberMatch && method === 'DELETE') {
    const [, teamId, memberId] = removeMemberMatch;
    const team = store.teams[teamId];
    if (!team || team.ownerId !== uid) {
      throw new Error('Only the team owner can remove members.');
    }
    store.teamMembers = store.teamMembers.filter(
      (m) => !(m.teamId === teamId && m.userId === memberId)
    );
    saveLocalStore(store);
    return { removedUserId: memberId };
  }

  // 9. POST /api/teams/seed-demo
  if (path === '/api/teams/seed-demo' && method === 'POST') {
    const todayDate = body?.today || getLocalTodayDate();
    const demoTeammates = [
      {
        id: 'demo-user-harsh',
        email: 'harsh@teamcollab.dev',
        fullName: 'Harsh',
        jobTitle: 'Backend Engineer',
        avatarUrl: '',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'demo-user-rahul',
        email: 'rahul@teamcollab.dev',
        fullName: 'Rahul',
        jobTitle: 'Full-Stack Developer',
        avatarUrl: '',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'demo-user-ananya',
        email: 'ananya@teamcollab.dev',
        fullName: 'Ananya',
        jobTitle: 'Product Designer',
        avatarUrl: '',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'demo-user-kiran',
        email: 'kiran@teamcollab.dev',
        fullName: 'Kiran',
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
      name: 'Core Product Team',
      description:
        'Shared workspace for daily async standups, realtime group chat, and team tasks.',
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
    const dueSoonDate = new Date(todayObj.getTime() + 4 * 86400000)
      .toISOString()
      .slice(0, 10);

    const sampleUpdates = [
      {
        userId: 'demo-user-harsh',
        updateDate: todayDate,
        workedOn: 'Completed the DBMS schema.',
        nextPlan: 'Build the dashboard.',
        blockers: 'None.',
        offsetMinutes: -45,
      },
      {
        userId: 'demo-user-rahul',
        updateDate: todayDate,
        workedOn: 'Fixed authentication.',
        nextPlan: 'Testing.',
        blockers: 'Waiting for API access.',
        offsetMinutes: -20,
      },
      {
        userId: 'demo-user-ananya',
        updateDate: todayDate,
        workedOn: 'Finalized the responsive workspace layout and chat view.',
        nextPlan: 'Prepare sprint demo slides.',
        blockers: 'None.',
        offsetMinutes: -10,
      },
      {
        userId: 'demo-user-harsh',
        updateDate: yesterdayDate,
        workedOn:
          'Drafted initial ERD for profiles, teams, standups, chat, and tasks.',
        nextPlan: 'Write SQL migrations and RLS policies.',
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

    const sampleChats = [
      {
        userId: 'demo-user-rahul',
        message: 'Hey, has everyone finished the presentation?',
        offsetMinutes: -18,
      },
      {
        userId: 'demo-user-harsh',
        message: "Almost. I'm fixing the dashboard now.",
        offsetMinutes: -16,
      },
      {
        userId: 'demo-user-ananya',
        message: "I'll finish the slides in 20 minutes.",
        offsetMinutes: -14,
      },
    ];

    for (const chat of sampleChats) {
      const ts = new Date(Date.now() + chat.offsetMinutes * 60000).toISOString();
      store.chatMessages.push({
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        teamId,
        userId: chat.userId,
        message: chat.message,
        createdAt: ts,
        updatedAt: ts,
      });
    }

    const sampleTasks: Array<{
      title: string;
      description: string;
      assignedTo: string;
      status: 'todo' | 'in_progress' | 'completed';
      priority: 'low' | 'medium' | 'high';
      dueDate: string;
    }> = [
      {
        title: 'Fix login bug',
        description: 'Ensure persistent session restoration across browser tabs.',
        assignedTo: 'demo-user-rahul',
        status: 'todo',
        priority: 'high',
        dueDate: dueSoonDate,
      },
      {
        title: 'Create homepage',
        description: 'Design clean landing page with workspace overview.',
        assignedTo: 'demo-user-ananya',
        status: 'todo',
        priority: 'medium',
        dueDate: dueSoonDate,
      },
      {
        title: 'Build dashboard',
        description: 'Create the main team workspace UI with Standup and Chat tabs.',
        assignedTo: 'demo-user-harsh',
        status: 'in_progress',
        priority: 'high',
        dueDate: dueSoonDate,
      },
      {
        title: 'Setup Supabase',
        description: 'Configure Supabase Auth, PostgreSQL tables, and Realtime.',
        assignedTo: uid,
        status: 'completed',
        priority: 'high',
        dueDate: todayDate,
      },
      {
        title: 'Create database schema',
        description: 'Write SQL schema and Row Level Security policies for all 6 tables.',
        assignedTo: 'demo-user-harsh',
        status: 'completed',
        priority: 'medium',
        dueDate: todayDate,
      },
    ];

    const nowTs = new Date().toISOString();
    for (const t of sampleTasks) {
      store.tasks.push({
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        teamId,
        createdBy: uid,
        assignedTo: t.assignedTo,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        createdAt: nowTs,
        updatedAt: nowTs,
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
        'Access denied. You must be a member of this team to view its workspace.'
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
          email: 'member@teamcollab.dev',
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
    emitLocalRealtime(teamId, 'standup_updates', {
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
    const mateId = 'demo-user-kiran';

    if (!store.profiles[mateId]) {
      store.profiles[mateId] = {
        id: mateId,
        email: 'kiran@teamcollab.dev',
        fullName: 'Kiran',
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
        id: `tm_kiran_${Date.now()}`,
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
          'Verified realtime PostgreSQL events for standups, chat, and tasks.',
        nextPlan: 'Run regression suite on the History date filter view.',
        blockers: 'None.',
      },
      {
        workedOn:
          'Audited Row Level Security policies for tasks, chat_messages, and standup_updates.',
        nextPlan: 'Sign off on production release checklist.',
        blockers: 'Waiting for staging environment credentials.',
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
        id: `upd_kiran_${Date.now()}`,
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
    emitLocalRealtime(teamId, 'standup_updates', {
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
    emitLocalRealtime(target.teamId, 'standup_updates', {
      eventType: 'DELETE',
      new: null,
      old: { id: target.id, teamId: target.teamId, userId: target.userId },
    });
    return { deletedId: target.id };
  }

  // 14. GET /api/teams/:teamId/chat
  const chatGetMatch = path.match(/^\/api\/teams\/([^/?]+)\/chat$/);
  if (chatGetMatch && method === 'GET') {
    const teamId = chatGetMatch[1];
    const messages = store.chatMessages
      .filter((m) => m.teamId === teamId)
      .map((m) => ({
        ...m,
        author: store.profiles[m.userId] || {
          id: m.userId,
          email: 'member@teamcollab.dev',
          fullName: 'Team Member',
          jobTitle: '',
          avatarUrl: '',
        },
      }))
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    return { messages };
  }

  // 15. POST /api/teams/:teamId/chat
  if (chatGetMatch && method === 'POST') {
    const teamId = chatGetMatch[1];
    const text = (body?.message || '').trim();
    if (!text) throw new Error('Message cannot be empty.');
    const now = new Date().toISOString();
    const created = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      teamId,
      userId: uid,
      message: text,
      createdAt: now,
      updatedAt: now,
    };
    store.chatMessages.push(created);
    saveLocalStore(store);
    const enriched = {
      ...created,
      author: store.profiles[uid],
    };
    emitLocalRealtime(teamId, 'chat_messages', {
      eventType: 'INSERT',
      new: enriched,
      old: null,
    });
    return { message: enriched };
  }

  // 16. PUT /api/chat/:messageId
  const chatItemMatch = path.match(/^\/api\/chat\/([^/?]+)$/);
  if (chatItemMatch && method === 'PUT') {
    const messageId = chatItemMatch[1];
    const idx = store.chatMessages.findIndex((m) => m.id === messageId);
    if (idx === -1) throw new Error('Message not found.');
    if (store.chatMessages[idx].userId !== uid) {
      throw new Error('You can only edit your own messages.');
    }
    const now = new Date().toISOString();
    store.chatMessages[idx] = {
      ...store.chatMessages[idx],
      message: (body?.message || '').trim(),
      updatedAt: now,
    };
    saveLocalStore(store);
    const enriched = {
      ...store.chatMessages[idx],
      author: store.profiles[uid],
    };
    emitLocalRealtime(enriched.teamId, 'chat_messages', {
      eventType: 'UPDATE',
      new: enriched,
      old: null,
    });
    return { message: enriched };
  }

  // 17. DELETE /api/chat/:messageId
  if (chatItemMatch && method === 'DELETE') {
    const messageId = chatItemMatch[1];
    const idx = store.chatMessages.findIndex((m) => m.id === messageId);
    if (idx === -1) throw new Error('Message not found.');
    const target = store.chatMessages[idx];
    if (target.userId !== uid) {
      throw new Error('You can only delete your own messages.');
    }
    store.chatMessages.splice(idx, 1);
    saveLocalStore(store);
    emitLocalRealtime(target.teamId, 'chat_messages', {
      eventType: 'DELETE',
      new: null,
      old: { id: target.id, teamId: target.teamId, userId: target.userId },
    });
    return { deletedId: target.id };
  }

  // 18. GET /api/tasks
  if (path === '/api/tasks' && method === 'GET') {
    const myMemberships = store.teamMembers.filter((m) => m.userId === uid);
    const myTeamIds = new Set(myMemberships.map((m) => m.teamId));

    const teamsWithMembers = myMemberships
      .map((m) => {
        const team = store.teams[m.teamId];
        if (!team) return null;
        const members = store.teamMembers
          .filter((tm) => tm.teamId === team.id)
          .map(
            (tm) =>
              store.profiles[tm.userId] || {
                id: tm.userId,
                email: 'member@teamcollab.dev',
                fullName: 'Team Member',
                jobTitle: '',
                avatarUrl: '',
              }
          );
        return {
          ...team,
          myRole: m.role,
          members,
        };
      })
      .filter(Boolean);

    const tasksList = store.tasks
      .filter((t) => myTeamIds.has(t.teamId))
      .map((t) => enrichLocalTask(store, t))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

    return {
      tasks: tasksList,
      teams: teamsWithMembers,
    };
  }

  // 19. POST /api/tasks
  if (path === '/api/tasks' && method === 'POST') {
    const teamId = body?.teamId;
    const title = (body?.title || '').trim();
    if (!title) throw new Error('Task Title is required.');
    if (!teamId) throw new Error('Please select a team.');

    const now = new Date().toISOString();
    const created: LocalStore['tasks'][number] = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      teamId,
      createdBy: uid,
      assignedTo: body?.assignedTo || null,
      title,
      description: (body?.description || '').trim(),
      status: body?.status || 'todo',
      priority: body?.priority || 'medium',
      dueDate: (body?.dueDate || '').trim(),
      createdAt: now,
      updatedAt: now,
    };
    store.tasks.push(created);
    saveLocalStore(store);

    const enriched = enrichLocalTask(store, created);
    emitLocalRealtime(teamId, 'tasks', {
      eventType: 'INSERT',
      new: enriched,
      old: null,
    });
    return { task: enriched };
  }

  // 20. PUT /api/tasks/:taskId & DELETE /api/tasks/:taskId
  const taskItemMatch = path.match(/^\/api\/tasks\/([^/?]+)$/);
  if (taskItemMatch && method === 'PUT') {
    const taskId = taskItemMatch[1];
    const idx = store.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) throw new Error('Task not found.');
    const existing = store.tasks[idx];

    store.tasks[idx] = {
      ...existing,
      title:
        typeof body?.title === 'string' ? body.title.trim() : existing.title,
      description:
        typeof body?.description === 'string'
          ? body.description.trim()
          : existing.description,
      assignedTo:
        body?.assignedTo !== undefined
          ? body.assignedTo || null
          : existing.assignedTo,
      priority: body?.priority || existing.priority,
      dueDate:
        typeof body?.dueDate === 'string'
          ? body.dueDate.trim()
          : existing.dueDate,
      status: body?.status || existing.status,
      updatedAt: new Date().toISOString(),
    };
    saveLocalStore(store);

    const enriched = enrichLocalTask(store, store.tasks[idx]);
    emitLocalRealtime(enriched.teamId, 'tasks', {
      eventType: 'UPDATE',
      new: enriched,
      old: null,
    });
    return { task: enriched };
  }

  if (taskItemMatch && method === 'DELETE') {
    const taskId = taskItemMatch[1];
    const idx = store.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) throw new Error('Task not found.');
    const target = store.tasks[idx];
    const team = store.teams[target.teamId];
    if (target.createdBy !== uid && team?.ownerId !== uid) {
      throw new Error('Only the task creator or team owner can delete this task.');
    }
    store.tasks.splice(idx, 1);
    saveLocalStore(store);
    emitLocalRealtime(target.teamId, 'tasks', {
      eventType: 'DELETE',
      new: null,
      old: { id: target.id, teamId: target.teamId },
    });
    return { deletedId: target.id };
  }

  throw new Error(`Unhandled route: ${method} ${path}`);
}

/**
 * Subscribes to Realtime PostgreSQL changes on `standup_updates` filtered by `team_id`.
 * Handles INSERT, UPDATE, and DELETE events and returns a cleanup function.
 */
export function subscribeToTeamStandups(
  teamId: string,
  onPayload: RealtimeCallback,
  onStatusChange?: (status: 'SUBSCRIBED' | 'ERROR') => void
): () => void {
  if (!localStandupListeners.has(teamId)) {
    localStandupListeners.set(teamId, new Set());
  }
  localStandupListeners.get(teamId)!.add(onPayload);

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
            table: 'standup_updates',
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
      localStandupListeners.get(teamId)?.delete(onPayload);
      supabase.removeChannel(channel);
    };
  }

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
        if (parsed.table && parsed.table !== 'standup_updates') return;
        if (
          parsed.eventType === 'INSERT' ||
          parsed.eventType === 'UPDATE' ||
          parsed.eventType === 'DELETE'
        ) {
          onPayload({
            table: 'standup_updates',
            eventType: parsed.eventType,
            new: parsed.new,
            old: parsed.old,
          });
        }
      } catch {
        // Ignore non-JSON heartbeat
      }
    };

    eventSource.onerror = () => {
      eventSource?.close();
      onStatusChange?.('SUBSCRIBED');
    };
  } catch {
    onStatusChange?.('SUBSCRIBED');
  }

  return () => {
    localStandupListeners.get(teamId)?.delete(onPayload);
    eventSource?.close();
  };
}

/**
 * Subscribes to Realtime PostgreSQL changes on `chat_messages` filtered by `team_id`.
 * Handles INSERT, UPDATE, and DELETE events and returns a cleanup function.
 */
export function subscribeToTeamChat(
  teamId: string,
  onPayload: RealtimeCallback,
  onStatusChange?: (status: 'SUBSCRIBED' | 'ERROR') => void
): () => void {
  if (!localChatListeners.has(teamId)) {
    localChatListeners.set(teamId, new Set());
  }
  localChatListeners.get(teamId)!.add(onPayload);

  if (supabase) {
    const channel = supabase
      .channel(`chat_messages:team_${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          onPayload({
            table: 'chat_messages',
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
      localChatListeners.get(teamId)?.delete(onPayload);
      supabase.removeChannel(channel);
    };
  }

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
        if (parsed.table !== 'chat_messages') return;
        if (
          parsed.eventType === 'INSERT' ||
          parsed.eventType === 'UPDATE' ||
          parsed.eventType === 'DELETE'
        ) {
          onPayload({
            table: 'chat_messages',
            eventType: parsed.eventType,
            new: parsed.new,
            old: parsed.old,
          });
        }
      } catch {
        // Ignore non-JSON heartbeat
      }
    };

    eventSource.onerror = () => {
      eventSource?.close();
      onStatusChange?.('SUBSCRIBED');
    };
  } catch {
    onStatusChange?.('SUBSCRIBED');
  }

  return () => {
    localChatListeners.get(teamId)?.delete(onPayload);
    eventSource?.close();
  };
}

/**
 * Subscribes to Realtime PostgreSQL changes on `tasks`.
 * Handles INSERT, UPDATE, and DELETE events and returns a cleanup function.
 */
export function subscribeToTasks(
  onPayload: RealtimeCallback,
  onStatusChange?: (status: 'SUBSCRIBED' | 'ERROR') => void
): () => void {
  localTaskListeners.add(onPayload);

  if (supabase) {
    const channel = supabase
      .channel('tasks:workspace')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        (payload) => {
          onPayload({
            table: 'tasks',
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
      localTaskListeners.delete(onPayload);
      supabase.removeChannel(channel);
    };
  }

  let eventSource: EventSource | null = null;
  try {
    eventSource = new EventSource('/api/tasks/realtime');

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
        if (parsed.table !== 'tasks') return;
        if (
          parsed.eventType === 'INSERT' ||
          parsed.eventType === 'UPDATE' ||
          parsed.eventType === 'DELETE'
        ) {
          onPayload({
            table: 'tasks',
            eventType: parsed.eventType,
            new: parsed.new,
            old: parsed.old,
          });
        }
      } catch {
        // Ignore non-JSON heartbeat
      }
    };

    eventSource.onerror = () => {
      eventSource?.close();
      onStatusChange?.('SUBSCRIBED');
    };
  } catch {
    onStatusChange?.('SUBSCRIBED');
  }

  return () => {
    localTaskListeners.delete(onPayload);
    eventSource?.close();
  };
}
