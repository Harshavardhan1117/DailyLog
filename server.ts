import express, { Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  requireAuth,
  AuthRequest,
  signSessionToken,
} from './src/middleware/auth.ts';
import {
  registerUserWithEmail,
  loginUserWithEmail,
  getOrCreateProfile,
  updateProfile,
  getUserTeams,
  createTeamForUser,
  joinTeamByInviteCode,
  getTeamBoardData,
  upsertStandupUpdate,
  deleteStandupUpdate,
  seedDemoTeamForUser,
  simulateTeammateRealtimeUpdate,
} from './src/db/queries.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Direct PostgreSQL Authentication Endpoints (Sign Up / Login / Session)
// ---------------------------------------------------------------------------

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res
        .status(400)
        .json({ error: 'Password must be at least 6 characters long.' });
    }
    const profile = await registerUserWithEmail(
      email,
      password,
      fullName || ''
    );
    const token = signSessionToken({
      uid: profile.id,
      email: profile.email,
      name: profile.fullName,
    });
    res.status(201).json({ token, profile });
  } catch (error: any) {
    console.error('Signup error:', error);
    res
      .status(400)
      .json({ error: error.message || 'Sign up failed. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'Please enter both email and password.' });
    }
    const profile = await loginUserWithEmail(email, password);
    const token = signSessionToken({
      uid: profile.id,
      email: profile.email,
      name: profile.fullName,
    });
    res.json({ token, profile });
  } catch (error: any) {
    console.error('Login error:', error);
    res
      .status(401)
      .json({ error: error.message || 'Invalid email or password.' });
  }
});

app.post('/api/auth/quick-session', async (req, res) => {
  try {
    const { email, fullName } = req.body;
    const targetEmail = (email || 'member@standuplog.dev').trim().toLowerCase();
    const uid = `user-${Buffer.from(targetEmail).toString('hex').slice(0, 20)}`;
    const profile = await getOrCreateProfile(
      uid,
      targetEmail,
      fullName || 'Alex Morgan',
      ''
    );
    const token = signSessionToken({
      uid: profile.id,
      email: profile.email,
      name: profile.fullName,
    });
    res.json({ token, profile });
  } catch (error: any) {
    console.error('Quick session error:', error);
    res.status(500).json({ error: 'Could not start session.' });
  }
});

// Realtime SSE Subscribers mapped by teamId
const teamSubscribers = new Map<string, Set<Response>>();

function broadcastRealtimeEvent(
  teamId: string,
  payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: any;
    old: any;
  }
) {
  const clients = teamSubscribers.get(teamId);
  if (!clients || clients.size === 0) return;

  const dataString = `data: ${JSON.stringify({
    table: 'standup_updates',
    schema: 'public',
    ...payload,
  })}\n\n`;

  for (const clientRes of clients) {
    try {
      clientRes.write(dataString);
    } catch {
      clients.delete(clientRes);
    }
  }
}

function getTodayDateString(queryDate?: string): string {
  if (queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
    return queryDate;
  }
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// API Routes (Secured with Firebase Auth & PostgreSQL)
// ---------------------------------------------------------------------------

// 1. Get or initialize current user's profile
app.get('/api/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const profile = await getOrCreateProfile(
      user.uid,
      user.email || 'member@standuplog.dev',
      user.name,
      user.picture
    );
    res.json({ profile });
  } catch (error: any) {
    console.error('Failed to get profile:', error);
    res.status(500).json({ error: error.message || 'Failed to load profile.' });
  }
});

// 2. Update current user's profile
app.put('/api/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { fullName, jobTitle } = req.body;
    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ error: 'Display name cannot be empty.' });
    }
    const profile = await updateProfile(user.uid, {
      fullName,
      jobTitle: jobTitle || '',
    });
    res.json({ profile });
  } catch (error: any) {
    console.error('Failed to update profile:', error);
    res.status(500).json({ error: error.message || 'Failed to update profile.' });
  }
});

// 3. List current user's teams
app.get('/api/teams', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    await getOrCreateProfile(
      user.uid,
      user.email || 'member@standuplog.dev',
      user.name,
      user.picture
    );
    const todayDate = getTodayDateString(req.query.today as string);
    const teamsList = await getUserTeams(user.uid, todayDate);
    res.json({ teams: teamsList });
  } catch (error: any) {
    console.error('Failed to fetch teams:', error);
    res.status(500).json({ error: error.message || 'Failed to load teams.' });
  }
});

// 4. Create a new team
app.post('/api/teams', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { name, description } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Please enter a team name.' });
    }
    await getOrCreateProfile(
      user.uid,
      user.email || 'member@standuplog.dev',
      user.name,
      user.picture
    );
    const team = await createTeamForUser(user.uid, name, description || '');
    res.status(201).json({ team });
  } catch (error: any) {
    console.error('Failed to create team:', error);
    res.status(500).json({ error: error.message || 'Failed to create team.' });
  }
});

// 5. Join a team via invite code
app.post('/api/teams/join', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { inviteCode } = req.body;
    if (!inviteCode || typeof inviteCode !== 'string' || !inviteCode.trim()) {
      return res.status(400).json({ error: 'Please enter a valid invite code.' });
    }
    await getOrCreateProfile(
      user.uid,
      user.email || 'member@standuplog.dev',
      user.name,
      user.picture
    );
    const team = await joinTeamByInviteCode(user.uid, inviteCode);
    res.json({ team });
  } catch (error: any) {
    console.error('Failed to join team:', error);
    const status = error.message?.includes('No team found') ? 404 : 500;
    res.status(status).json({ error: error.message || 'Could not join team.' });
  }
});

// 6. Seed a demo team with sample updates for quick onboarding
app.post('/api/teams/seed-demo', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    await getOrCreateProfile(
      user.uid,
      user.email || 'member@standuplog.dev',
      user.name,
      user.picture
    );
    const todayDate = getTodayDateString(req.body?.today);
    const team = await seedDemoTeamForUser(user.uid, todayDate);
    res.status(201).json({ team });
  } catch (error: any) {
    console.error('Failed to seed demo team:', error);
    res.status(500).json({ error: error.message || 'Failed to create demo team.' });
  }
});

// 7. Fetch team bulletin board data (for a specific date or all history)
app.get('/api/teams/:teamId/board', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { teamId } = req.params;
    const dateFilter = req.query.date as string | undefined;
    const boardData = await getTeamBoardData(user.uid, teamId, dateFilter);
    res.json(boardData);
  } catch (error: any) {
    console.error('Failed to fetch team board:', error);
    if (error.message === 'UNAUTHORIZED_TEAM_ACCESS') {
      return res.status(403).json({
        error: 'Access denied. You must be a member of this team to view its bulletin board.',
      });
    }
    if (error.message === 'TEAM_NOT_FOUND') {
      return res.status(404).json({ error: 'Team not found.' });
    }
    res.status(500).json({ error: error.message || 'Failed to load team board.' });
  }
});

// 8. Create or edit today's standup update
app.post('/api/teams/:teamId/updates', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { teamId } = req.params;
    const { updateDate, workedOn, nextPlan, blockers } = req.body;

    if (!workedOn || !workedOn.trim() || !nextPlan || !nextPlan.trim()) {
      return res.status(400).json({
        error: 'Please fill in both "What did you work on?" and "What are you working on next?".',
      });
    }

    const targetDate = getTodayDateString(updateDate);
    const result = await upsertStandupUpdate(
      user.uid,
      teamId,
      targetDate,
      workedOn,
      nextPlan,
      blockers || 'None.'
    );

    // Broadcast to all Realtime subscribers viewing this team
    broadcastRealtimeEvent(teamId, {
      eventType: result.eventType as 'INSERT' | 'UPDATE',
      new: result.record,
      old: null,
    });

    res.json({ update: result.record, eventType: result.eventType });
  } catch (error: any) {
    console.error('Failed to save standup update:', error);
    if (error.message === 'UNAUTHORIZED_TEAM_ACCESS') {
      return res.status(403).json({
        error: 'You are not authorized to post updates to this team.',
      });
    }
    res.status(500).json({ error: error.message || 'Failed to submit standup update.' });
  }
});

// 9. Simulate a teammate posting a live update (for testing Realtime in 1 click)
app.post(
  '/api/teams/:teamId/simulate-realtime',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { teamId } = req.params;
      const todayDate = getTodayDateString(req.body?.today);

      const result = await simulateTeammateRealtimeUpdate(
        user.uid,
        teamId,
        todayDate
      );

      broadcastRealtimeEvent(teamId, {
        eventType: result.eventType as 'INSERT' | 'UPDATE',
        new: result.record,
        old: null,
      });

      res.json({ update: result.record, eventType: result.eventType });
    } catch (error: any) {
      console.error('Failed to simulate realtime update:', error);
      res.status(500).json({
        error: error.message || 'Failed to simulate teammate update.',
      });
    }
  }
);

// 10. Delete user's own standup update
app.delete('/api/updates/:updateId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { updateId } = req.params;
    const deleted = await deleteStandupUpdate(user.uid, updateId);

    broadcastRealtimeEvent(deleted.teamId, {
      eventType: 'DELETE',
      new: null,
      old: { id: deleted.id, teamId: deleted.teamId, userId: deleted.userId },
    });

    res.json({ deletedId: deleted.id });
  } catch (error: any) {
    console.error('Failed to delete standup update:', error);
    if (error.message === 'FORBIDDEN_NOT_OWNER') {
      return res.status(403).json({
        error: 'You can only delete your own daily standup update.',
      });
    }
    if (error.message === 'UPDATE_NOT_FOUND') {
      return res.status(404).json({ error: 'Standup update not found.' });
    }
    res.status(500).json({ error: error.message || 'Failed to delete update.' });
  }
});

// 11. Realtime stream for a team board (PostgreSQL change notifications)
app.get('/api/teams/:teamId/realtime', (req, res) => {
  const { teamId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ type: 'SUBSCRIBED', teamId })}\n\n`);

  if (!teamSubscribers.has(teamId)) {
    teamSubscribers.set(teamId, new Set());
  }
  teamSubscribers.get(teamId)!.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    teamSubscribers.get(teamId)?.delete(res);
  });
});

// ---------------------------------------------------------------------------
// Start Server with Vite Middleware in Dev / Static in Prod
// ---------------------------------------------------------------------------
async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Daily Standup Log server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
