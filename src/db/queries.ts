import { db } from './index.ts';
import {
  profiles,
  teams,
  teamMembers,
  standupUpdates,
  chatMessages,
} from './schema.ts';
import { eq, and, desc, asc } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Generates a short readable invite code (e.g. "TEAM-7F4A92")
 */
function generateInviteCode(name: string): string {
  const prefix =
    name
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
      return sanitizeProfile(existing[0]);
    }

    const result = await db
      .insert(profiles)
      .values({
        id: uid,
        email,
        fullName: defaultName,
        jobTitle: 'Team Member',
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

    return sanitizeProfile(result[0]);
  } catch (error) {
    console.error('Database query failed in getOrCreateProfile:', error);
    throw new Error('Could not load user profile. Please try again.', {
      cause: error,
    });
  }
}

export async function updateProfile(
  uid: string,
  data: { fullName: string; jobTitle: string; avatarUrl?: string }
) {
  try {
    const updatePayload: any = {
      fullName: data.fullName.trim(),
      jobTitle: data.jobTitle.trim(),
      updatedAt: new Date(),
    };
    if (typeof data.avatarUrl === 'string') {
      updatePayload.avatarUrl = data.avatarUrl.trim();
    }

    const result = await db
      .update(profiles)
      .set(updatePayload)
      .where(eq(profiles.id, uid))
      .returning();

    return sanitizeProfile(result[0]);
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
    throw new Error(
      'Could not join team. Check the invite code and try again.',
      { cause: error }
    );
  }
}

/**
 * Allows a user to leave a team. If the owner leaves and is the only member, deletes the team.
 */
export async function leaveTeamForUser(uid: string, teamId: string) {
  try {
    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, uid)));
    return { success: true };
  } catch (error) {
    console.error('Database query failed in leaveTeamForUser:', error);
    throw new Error('Could not leave team. Please try again.', {
      cause: error,
    });
  }
}

/**
 * Allows a team owner to remove a member from the team.
 */
export async function removeTeamMember(
  requesterUid: string,
  teamId: string,
  targetUserId: string
) {
  try {
    const foundTeams = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId));

    if (foundTeams.length === 0) {
      throw new Error('TEAM_NOT_FOUND');
    }

    if (foundTeams[0].ownerId !== requesterUid) {
      throw new Error('FORBIDDEN_NOT_OWNER');
    }

    if (targetUserId === requesterUid) {
      throw new Error('CANNOT_REMOVE_SELF');
    }

    await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, targetUserId)
        )
      );

    return { removedUserId: targetUserId };
  } catch (error: any) {
    console.error('Database query failed in removeTeamMember:', error);
    if (
      error.message === 'TEAM_NOT_FOUND' ||
      error.message === 'FORBIDDEN_NOT_OWNER' ||
      error.message === 'CANNOT_REMOVE_SELF'
    ) {
      throw error;
    }
    throw new Error('Could not remove member from team.', { cause: error });
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
 * Loads full team details, members with profiles, and standup updates.
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
      author: sanitizeProfile(author),
    }));

    return {
      team,
      myRole: membership.role,
      members: membersRows.map((m) => ({
        ...m,
        user: sanitizeProfile(m.user),
      })),
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
    throw new Error('Failed to load team workspace.', { cause: error });
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
        author: sanitizeProfile(author),
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

// ============================================================================
// Group Chat Database Queries (chat_messages)
// ============================================================================

/**
 * Fetches all chat messages for a team ordered oldest-to-newest so newest are at the bottom.
 */
export async function getTeamChatMessages(uid: string, teamId: string) {
  try {
    const membership = await verifyTeamMembership(uid, teamId);
    if (!membership) {
      throw new Error('UNAUTHORIZED_TEAM_ACCESS');
    }

    const rows = await db
      .select({
        msg: chatMessages,
        author: profiles,
      })
      .from(chatMessages)
      .innerJoin(profiles, eq(chatMessages.userId, profiles.id))
      .where(eq(chatMessages.teamId, teamId))
      .orderBy(asc(chatMessages.createdAt));

    return rows.map(({ msg, author }) => ({
      ...msg,
      author: sanitizeProfile(author),
    }));
  } catch (error: any) {
    console.error('Database query failed in getTeamChatMessages:', error);
    if (error.message === 'UNAUTHORIZED_TEAM_ACCESS') throw error;
    throw new Error('Unable to load chat messages. Please try again.', {
      cause: error,
    });
  }
}

/**
 * Inserts a new chat message in `chat_messages` for a team member.
 */
export async function createChatMessage(
  uid: string,
  teamId: string,
  messageText: string
) {
  try {
    const membership = await verifyTeamMembership(uid, teamId);
    if (!membership) {
      throw new Error('UNAUTHORIZED_TEAM_ACCESS');
    }

    const now = new Date();
    const [created] = await db
      .insert(chatMessages)
      .values({
        id: crypto.randomUUID(),
        teamId,
        userId: uid,
        message: messageText.trim(),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [author] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, uid));

    return {
      ...created,
      author: sanitizeProfile(author),
    };
  } catch (error: any) {
    console.error('Database query failed in createChatMessage:', error);
    if (error.message === 'UNAUTHORIZED_TEAM_ACCESS') throw error;
    throw new Error('Unable to send message. Please try again.', {
      cause: error,
    });
  }
}

/**
 * Updates a user's own chat message.
 */
export async function updateChatMessage(
  uid: string,
  messageId: string,
  newText: string
) {
  try {
    const found = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId));

    if (found.length === 0) {
      throw new Error('MESSAGE_NOT_FOUND');
    }

    if (found[0].userId !== uid) {
      throw new Error('FORBIDDEN_NOT_OWNER');
    }

    const [updated] = await db
      .update(chatMessages)
      .set({
        message: newText.trim(),
        updatedAt: new Date(),
      })
      .where(eq(chatMessages.id, messageId))
      .returning();

    const [author] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, uid));

    return {
      ...updated,
      author: sanitizeProfile(author),
    };
  } catch (error: any) {
    console.error('Database query failed in updateChatMessage:', error);
    if (
      error.message === 'MESSAGE_NOT_FOUND' ||
      error.message === 'FORBIDDEN_NOT_OWNER'
    ) {
      throw error;
    }
    throw new Error('Unable to update message. Please try again.', {
      cause: error,
    });
  }
}

/**
 * Deletes a user's own chat message.
 */
export async function deleteChatMessage(uid: string, messageId: string) {
  try {
    const found = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId));

    if (found.length === 0) {
      throw new Error('MESSAGE_NOT_FOUND');
    }

    if (found[0].userId !== uid) {
      throw new Error('FORBIDDEN_NOT_OWNER');
    }

    await db.delete(chatMessages).where(eq(chatMessages.id, messageId));
    return found[0];
  } catch (error: any) {
    console.error('Database query failed in deleteChatMessage:', error);
    if (
      error.message === 'MESSAGE_NOT_FOUND' ||
      error.message === 'FORBIDDEN_NOT_OWNER'
    ) {
      throw error;
    }
    throw new Error('Unable to delete message. Please try again.', {
      cause: error,
    });
  }
}

/**
 * Seeds a demo team with sample teammates (Harsh, Rahul, Ananya, Kiran),
 * realistic standup updates, and initial group chat messages.
 */
export async function seedDemoTeamForUser(uid: string, todayDate: string) {
  try {
    const demoTeammates = [
      {
        id: 'demo-user-harsh',
        email: 'harsh@teamcollab.dev',
        fullName: 'Harsh',
        jobTitle: 'Backend Engineer',
      },
      {
        id: 'demo-user-rahul',
        email: 'rahul@teamcollab.dev',
        fullName: 'Rahul',
        jobTitle: 'Full-Stack Developer',
      },
      {
        id: 'demo-user-ananya',
        email: 'ananya@teamcollab.dev',
        fullName: 'Ananya',
        jobTitle: 'Product Designer',
      },
      {
        id: 'demo-user-kiran',
        email: 'kiran@teamcollab.dev',
        fullName: 'Kiran',
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
        name: 'Core Product Team',
        description:
          'Shared workspace for daily async standups and realtime group chat.',
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

    const todayObj = new Date(`${todayDate}T12:00:00Z`);
    const yesterdayObj = new Date(todayObj.getTime() - 86400000);
    const yesterdayDate = yesterdayObj.toISOString().slice(0, 10);

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
        workedOn: 'Drafted initial ERD for profiles, teams, standups, and chat.',
        nextPlan: 'Write SQL migrations and RLS policies.',
        blockers: 'None.',
        offsetMinutes: -1440,
      },
      {
        userId: 'demo-user-rahul',
        updateDate: yesterdayDate,
        workedOn: 'Configured Vite and React Router workspace.',
        nextPlan: 'Connect Supabase Auth session persistence.',
        blockers: 'None.',
        offsetMinutes: -1400,
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

    // Seed sample group chat conversation
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
      const ts = new Date(Date.now() + chat.offsetMinutes * 60000);
      await db.insert(chatMessages).values({
        id: crypto.randomUUID(),
        teamId,
        userId: chat.userId,
        message: chat.message,
        createdAt: ts,
        updatedAt: ts,
      });
    }

    return createdTeam;
  } catch (error) {
    console.error('Database query failed in seedDemoTeamForUser:', error);
    throw new Error('Could not seed demo team.', { cause: error });
  }
}

/**
 * Simulates a live teammate posting or updating their standup on the current team board.
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

    const mateId = 'demo-user-kiran';
    await db
      .insert(profiles)
      .values({
        id: mateId,
        email: 'kiran@teamcollab.dev',
        fullName: 'Kiran',
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
        workedOn: 'Verified realtime PostgreSQL events for standups and group chat.',
        nextPlan: 'Run regression tests on History date filters.',
        blockers: 'None.',
      },
      {
        workedOn: 'Audited Row Level Security policies for chat_messages and standup_updates.',
        nextPlan: 'Sign off on production deployment checklist.',
        blockers: 'Waiting for staging environment credentials.',
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
