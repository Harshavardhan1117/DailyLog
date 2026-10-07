import { db } from './index.ts';
import { profiles, teams, teamMembers, standupUpdates } from './schema.ts';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Generates a short readable invite code (e.g. "TEAM-7F4A92")
 */
function generateInviteCode(name: string): string {
  const prefix = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4) || 'TEAM';
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${suffix}`;
}

function sanitizeProfile(row: any) {
  if (!row) return row;
  const { passwordHash, ...rest } = row;
  return rest;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPasswordHash(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

/**
 * Registers a new user with email, password, and full name in PostgreSQL.
 */
export async function registerUserWithEmail(
  email: string,
  password: string,
  fullName: string
) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, normalizedEmail));

    if (existing.length > 0) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    const uid = crypto.randomUUID();
    const displayName =
      fullName.trim() || normalizedEmail.split('@')[0] || 'Team Member';
    const passwordHash = hashPassword(password);

    const [created] = await db
      .insert(profiles)
      .values({
        id: uid,
        email: normalizedEmail,
        fullName: displayName,
        passwordHash,
        jobTitle: 'Team Member',
        avatarUrl: '',
      })
      .returning();

    return sanitizeProfile(created);
  } catch (error: any) {
    console.error('Database query failed in registerUserWithEmail:', error);
    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      throw new Error(
        'An account with this email already exists. Please log in instead.'
      );
    }
    throw new Error('Could not create account. Please try again.', {
      cause: error,
    });
  }
}

/**
 * Authenticates an existing user by email and password against PostgreSQL.
 */
export async function loginUserWithEmail(email: string, password: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, normalizedEmail));

    if (existing.length === 0) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const userRow = existing[0];
    if (!verifyPasswordHash(password, userRow.passwordHash)) {
      throw new Error('INVALID_CREDENTIALS');
    }

    return sanitizeProfile(userRow);
  } catch (error: any) {
    console.error('Database query failed in loginUserWithEmail:', error);
    if (error.message === 'INVALID_CREDENTIALS') {
      throw new Error(
        'Invalid email or password. Please check your credentials or sign up first.'
      );
    }
    throw new Error('Login failed. Please try again.', { cause: error });
  }
}

/**
 * Upserts a user profile safely under concurrent requests.
 */
export async function getOrCreateProfile(
  uid: string,
  email: string,
  fullName?: string,
  avatarUrl?: string
) {
  try {
    const defaultName =
      fullName?.trim() || email.split('@')[0] || 'Team Member';

    const existing = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, uid));

    if (existing.length > 0) {
      return existing[0];
    }

    const result = await db
      .insert(profiles)
      .values({
        id: uid,
        email,
        fullName: defaultName,
        jobTitle: 'Software Engineer',
        avatarUrl: avatarUrl || '',
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          email,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateProfile:', error);
    throw new Error('Could not load user profile. Please try again.', {
      cause: error,
    });
  }
}

export async function updateProfile(
  uid: string,
  data: { fullName: string; jobTitle: string }
) {
  try {
    const result = await db
      .update(profiles)
      .set({
        fullName: data.fullName.trim(),
        jobTitle: data.jobTitle.trim(),
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, uid))
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in updateProfile:', error);
    throw new Error('Could not update profile settings.', { cause: error });
  }
}

/**
 * Fetches all teams the user belongs to, along with member counts and today's stats.
 */
export async function getUserTeams(uid: string, todayDate: string) {
  try {
    const memberships = await db
      .select({
        membership: teamMembers,
        team: teams,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, uid))
      .orderBy(desc(teams.createdAt));

    const enriched = await Promise.all(
      memberships.map(async ({ membership, team }) => {
        const allMembers = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.teamId, team.id));

        const todaysUpdates = await db
          .select()
          .from(standupUpdates)
          .where(
            and(
              eq(standupUpdates.teamId, team.id),
              eq(standupUpdates.updateDate, todayDate)
            )
          );

        const blockersCount = todaysUpdates.filter(
          (u) =>
            u.blockers &&
            u.blockers.trim() !== '' &&
            u.blockers.trim().toLowerCase() !== 'none' &&
            u.blockers.trim().toLowerCase() !== 'none.' &&
            u.blockers.trim().toLowerCase() !== 'n/a'
        ).length;

        return {
          ...team,
          myRole: membership.role,
          memberCount: allMembers.length,
          postedTodayCount: todaysUpdates.length,
          blockersTodayCount: blockersCount,
        };
      })
    );

    return enriched;
  } catch (error) {
    console.error('Database query failed in getUserTeams:', error);
    throw new Error('Could not load your teams.', { cause: error });
  }
}

/**
 * Creates a new team and registers the creator as owner.
 */
export async function createTeamForUser(
  uid: string,
  name: string,
  description: string
) {
  try {
    const teamId = crypto.randomUUID();
    const inviteCode = generateInviteCode(name);

    const [createdTeam] = await db
      .insert(teams)
      .values({
        id: teamId,
        name: name.trim(),
        description: description.trim(),
        inviteCode,
        ownerId: uid,
      })
      .returning();

    await db.insert(teamMembers).values({
      id: crypto.randomUUID(),
      teamId,
      userId: uid,
      role: 'owner',
    });

    return createdTeam;
  } catch (error) {
    console.error('Database query failed in createTeamForUser:', error);
    throw new Error('Could not create team. Please try again.', {
      cause: error,
    });
  }
}

/**
 * Joins an existing team using its invite code.
 */
export async function joinTeamByInviteCode(uid: string, inviteCode: string) {
  try {
    const normalized = inviteCode.trim().toUpperCase();
    const foundTeams = await db
      .select()
      .from(teams)
      .where(eq(teams.inviteCode, normalized));

    if (foundTeams.length === 0) {
      throw new Error('No team found with that invite code.');
    }

    const team = foundTeams[0];

    await db
      .insert(teamMembers)
      .values({
        id: crypto.randomUUID(),
        teamId: team.id,
        userId: uid,
        role: 'member',
      })
      .onConflictDoNothing();

    return team;
  } catch (error: any) {
    console.error('Database query failed in joinTeamByInviteCode:', error);
    if (error.message === 'No team found with that invite code.') {
      throw error;
    }
    throw new Error('Could not join team. Check the invite code and try again.', {
      cause: error,
    });
  }
}

/**
 * Verifies user is a member of the team (RLS-equivalent backend check).
 */
export async function verifyTeamMembership(uid: string, teamId: string) {
  try {
    const found = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, uid)));

    return found[0] || null;
  } catch (error) {
    console.error('Database query failed in verifyTeamMembership:', error);
    throw new Error('Could not verify team membership.', { cause: error });
  }
}

/**
 * Loads full team details, members with profiles, and updates (for a specific date or all history).
 */
export async function getTeamBoardData(
  uid: string,
  teamId: string,
  dateFilter?: string
) {
  try {
    const membership = await verifyTeamMembership(uid, teamId);
    if (!membership) {
      throw new Error('UNAUTHORIZED_TEAM_ACCESS');
    }

    const foundTeams = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId));

    if (foundTeams.length === 0) {
      throw new Error('TEAM_NOT_FOUND');
    }

    const team = foundTeams[0];

    const membersRows = await db
      .select({
        id: teamMembers.id,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
        user: profiles,
      })
      .from(teamMembers)
      .innerJoin(profiles, eq(teamMembers.userId, profiles.id))
      .where(eq(teamMembers.teamId, teamId));

    const updatesQuery = dateFilter
      ? and(
          eq(standupUpdates.teamId, teamId),
          eq(standupUpdates.updateDate, dateFilter)
        )
      : eq(standupUpdates.teamId, teamId);

    const updatesRows = await db
      .select({
        update: standupUpdates,
        author: profiles,
      })
      .from(standupUpdates)
      .innerJoin(profiles, eq(standupUpdates.userId, profiles.id))
      .where(updatesQuery)
      .orderBy(desc(standupUpdates.updatedAt));

    const formattedUpdates = updatesRows.map(({ update, author }) => ({
      ...update,
      author,
    }));

    return {
      team,
      myRole: membership.role,
      members: membersRows,
      updates: formattedUpdates,
    };
  } catch (error: any) {
    console.error('Database query failed in getTeamBoardData:', error);
    if (
      error.message === 'UNAUTHORIZED_TEAM_ACCESS' ||
      error.message === 'TEAM_NOT_FOUND'
    ) {
      throw error;
    }
    throw new Error('Failed to load team bulletin board.', { cause: error });
  }
}

/**
 * Upserts (creates or edits) a daily standup update for a user.
 * Enforces UNIQUE(team_id, user_id, update_date) and membership verification.
 */
export async function upsertStandupUpdate(
  uid: string,
  teamId: string,
  updateDate: string,
  workedOn: string,
  nextPlan: string,
  blockers: string
) {
  try {
    const membership = await verifyTeamMembership(uid, teamId);
    if (!membership) {
      throw new Error('UNAUTHORIZED_TEAM_ACCESS');
    }

    const existing = await db
      .select()
      .from(standupUpdates)
      .where(
        and(
          eq(standupUpdates.teamId, teamId),
          eq(standupUpdates.userId, uid),
          eq(standupUpdates.updateDate, updateDate)
        )
      );

    const isInsert = existing.length === 0;
    const now = new Date();

    const [saved] = await db
      .insert(standupUpdates)
      .values({
        id: isInsert ? crypto.randomUUID() : existing[0].id,
        teamId,
        userId: uid,
        updateDate,
        workedOn: workedOn.trim(),
        nextPlan: nextPlan.trim(),
        blockers: blockers.trim() || 'None.',
        createdAt: isInsert ? now : existing[0].createdAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          standupUpdates.teamId,
          standupUpdates.userId,
          standupUpdates.updateDate,
        ],
        set: {
          workedOn: workedOn.trim(),
          nextPlan: nextPlan.trim(),
          blockers: blockers.trim() || 'None.',
          updatedAt: now,
        },
      })
      .returning();

    const [author] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, uid));

    return {
      eventType: isInsert ? 'INSERT' : 'UPDATE',
      record: {
        ...saved,
        author,
      },
    };
  } catch (error: any) {
    console.error('Database query failed in upsertStandupUpdate:', error);
    if (error.message === 'UNAUTHORIZED_TEAM_ACCESS') throw error;
    throw new Error('Failed to save your daily standup update.', {
      cause: error,
    });
  }
}

/**
 * Deletes a user's own standup update. Users cannot delete another user's update.
 */
export async function deleteStandupUpdate(uid: string, updateId: string) {
  try {
    const found = await db
      .select()
      .from(standupUpdates)
      .where(eq(standupUpdates.id, updateId));

    if (found.length === 0) {
      throw new Error('UPDATE_NOT_FOUND');
    }

    if (found[0].userId !== uid) {
      throw new Error('FORBIDDEN_NOT_OWNER');
    }

    await db.delete(standupUpdates).where(eq(standupUpdates.id, updateId));

    return found[0];
  } catch (error: any) {
    console.error('Database query failed in deleteStandupUpdate:', error);
    if (
      error.message === 'UPDATE_NOT_FOUND' ||
      error.message === 'FORBIDDEN_NOT_OWNER'
    ) {
      throw error;
    }
    throw new Error('Failed to delete standup update.', { cause: error });
  }
}

/**
 * Seeds a demo team with sample teammates (Harsh, Rahul, Priya, Maya) and realistic daily updates
 * so a beginner user can immediately explore the bulletin board, blockers, and history.
 */
export async function seedDemoTeamForUser(uid: string, todayDate: string) {
  try {
    const demoTeammates = [
      {
        id: 'demo-user-harsh',
        email: 'harsh@standuplog.dev',
        fullName: 'Harsh',
        jobTitle: 'Backend Engineer',
      },
      {
        id: 'demo-user-rahul',
        email: 'rahul@standuplog.dev',
        fullName: 'Rahul Sharma',
        jobTitle: 'Full-Stack Developer',
      },
      {
        id: 'demo-user-priya',
        email: 'priya@standuplog.dev',
        fullName: 'Priya Patel',
        jobTitle: 'Product Designer',
      },
      {
        id: 'demo-user-maya',
        email: 'maya@standuplog.dev',
        fullName: 'Maya Lin',
        jobTitle: 'QA & Release Lead',
      },
    ];

    for (const mate of demoTeammates) {
      await db
        .insert(profiles)
        .values({
          id: mate.id,
          email: mate.email,
          fullName: mate.fullName,
          jobTitle: mate.jobTitle,
          avatarUrl: '',
        })
        .onConflictDoNothing();
    }

    const teamId = crypto.randomUUID();
    const inviteCode = generateInviteCode('CORE');

    const [createdTeam] = await db
      .insert(teams)
      .values({
        id: teamId,
        name: 'Core Product Engineering',
        description:
          'Daily async standup board for the Core Platform & API engineering squad.',
        inviteCode,
        ownerId: uid,
      })
      .returning();

    // Add current user as owner
    await db.insert(teamMembers).values({
      id: crypto.randomUUID(),
      teamId,
      userId: uid,
      role: 'owner',
    });

    // Add demo teammates
    for (const mate of demoTeammates) {
      await db
        .insert(teamMembers)
        .values({
          id: crypto.randomUUID(),
          teamId,
          userId: mate.id,
          role: 'member',
        })
        .onConflictDoNothing();
    }

    // Calculate yesterday's date string
    const todayObj = new Date(`${todayDate}T12:00:00Z`);
    const yesterdayObj = new Date(todayObj.getTime() - 86400000);
    const twoDaysAgoObj = new Date(todayObj.getTime() - 2 * 86400000);
    const yesterdayDate = yesterdayObj.toISOString().slice(0, 10);
    const twoDaysAgoDate = twoDaysAgoObj.toISOString().slice(0, 10);

    const sampleUpdates = [
      {
        userId: 'demo-user-harsh',
        updateDate: todayDate,
        workedOn: 'Completed the PostgreSQL DBMS schema and configured Row Level Security policies for team isolation.',
        nextPlan: 'Build the main team bulletin board view and hook up Realtime subscriptions.',
        blockers: 'None.',
        offsetMinutes: -45,
      },
      {
        userId: 'demo-user-rahul',
        updateDate: todayDate,
        workedOn: 'Fixed authentication session persistence and added protected route guards.',
        nextPlan: 'End-to-end testing of invite codes and team switching.',
        blockers: 'Waiting for staging OAuth callback URL approval from DevOps.',
        offsetMinutes: -20,
      },
      {
        userId: 'demo-user-priya',
        updateDate: todayDate,
        workedOn: 'Finalized responsive card layout and blocker warning badges for mobile screens.',
        nextPlan: 'Review history date filter interactions with engineering.',
        blockers: 'None.',
        offsetMinutes: -8,
      },
      // Yesterday's updates
      {
        userId: 'demo-user-harsh',
        updateDate: yesterdayDate,
        workedOn: 'Drafted initial ERD for profiles, teams, team_members, and standup_updates.',
        nextPlan: 'Write SQL migrations and test unique constraints.',
        blockers: 'None.',
        offsetMinutes: -1440,
      },
      {
        userId: 'demo-user-rahul',
        updateDate: yesterdayDate,
        workedOn: 'Set up Vite + React Router skeleton and Tailwind configuration.',
        nextPlan: 'Implement login and signup flows.',
        blockers: 'None.',
        offsetMinutes: -1400,
      },
      {
        userId: 'demo-user-maya',
        updateDate: yesterdayDate,
        workedOn: 'Prepared QA checklist for realtime INSERT, UPDATE, and DELETE events.',
        nextPlan: 'Verify multi-tab sync latency.',
        blockers: 'Staging environment seed script needed updating.',
        offsetMinutes: -1360,
      },
      // 2 days ago updates
      {
        userId: 'demo-user-priya',
        updateDate: twoDaysAgoDate,
        workedOn: 'Conducted user interviews on async standup friction points.',
        nextPlan: 'Create clean bulletin board wireframes.',
        blockers: 'None.',
        offsetMinutes: -2880,
      },
    ];

    for (const item of sampleUpdates) {
      const ts = new Date(Date.now() + item.offsetMinutes * 60000);
      await db
        .insert(standupUpdates)
        .values({
          id: crypto.randomUUID(),
          teamId,
          userId: item.userId,
          updateDate: item.updateDate,
          workedOn: item.workedOn,
          nextPlan: item.nextPlan,
          blockers: item.blockers,
          createdAt: ts,
          updatedAt: ts,
        })
        .onConflictDoNothing();
    }

    return createdTeam;
  } catch (error) {
    console.error('Database query failed in seedDemoTeamForUser:', error);
    throw new Error('Could not seed demo team.', { cause: error });
  }
}

/**
 * Simulates a live teammate posting or updating their standup on the current team board
 * so users can test Realtime updates with one click.
 */
export async function simulateTeammateRealtimeUpdate(
  uid: string,
  teamId: string,
  todayDate: string
) {
  try {
    const membership = await verifyTeamMembership(uid, teamId);
    if (!membership) {
      throw new Error('UNAUTHORIZED_TEAM_ACCESS');
    }

    const mateId = 'demo-user-maya';
    await db
      .insert(profiles)
      .values({
        id: mateId,
        email: 'maya@standuplog.dev',
        fullName: 'Maya Lin',
        jobTitle: 'QA & Release Lead',
        avatarUrl: '',
      })
      .onConflictDoNothing();

    await db
      .insert(teamMembers)
      .values({
        id: crypto.randomUUID(),
        teamId,
        userId: mateId,
        role: 'member',
      })
      .onConflictDoNothing();

    const samples = [
      {
        workedOn: 'Verified realtime PostgreSQL event broadcasting across concurrent browser tabs.',
        nextPlan: 'Run regression suite on the History date filter view.',
        blockers: 'None.',
      },
      {
        workedOn: 'Audited Row Level Security policies for standup_updates and team_members.',
        nextPlan: 'Sign off on production release checklist.',
        blockers: 'Blocked on final confirmation for mobile Safari viewport test.',
      },
    ];
    const pick = samples[Math.floor(Math.random() * samples.length)];

    return await upsertStandupUpdate(
      mateId,
      teamId,
      todayDate,
      pick.workedOn,
      pick.nextPlan,
      pick.blockers
    );
  } catch (error) {
    console.error('Database query failed in simulateTeammateRealtimeUpdate:', error);
    throw new Error('Could not simulate teammate update.', { cause: error });
  }
}
