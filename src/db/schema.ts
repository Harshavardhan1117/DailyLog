import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Profiles table linked to authenticated users (auth.users).
 */
export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  passwordHash: text('password_hash').default('').notNull(),
  jobTitle: text('job_title').default('').notNull(),
  avatarUrl: text('avatar_url').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Teams table representing a team workspace.
 */
export const teams = pgTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').default('').notNull(),
  inviteCode: text('invite_code').notNull().unique(),
  ownerId: text('owner_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Team membership table linking users to teams with role ('owner' | 'member').
 */
export const teamMembers = pgTable(
  'team_members',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .references(() => teams.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').notNull().default('member'), // 'owner' | 'member'
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('team_members_team_user_unique').on(table.teamId, table.userId),
  ]
);

/**
 * Daily standup updates table.
 * Enforces UNIQUE(team_id, user_id, update_date) so each member has one update per day per team.
 */
export const standupUpdates = pgTable(
  'standup_updates',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .references(() => teams.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    updateDate: text('update_date').notNull(), // Format: YYYY-MM-DD
    workedOn: text('worked_on').notNull(),
    nextPlan: text('next_plan').notNull(),
    blockers: text('blockers').default('').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('standup_updates_team_user_date_unique').on(
      table.teamId,
      table.userId,
      table.updateDate
    ),
  ]
);

/**
 * Realtime team group chat messages table.
 * Every message belongs to one team and one user.
 */
export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey(),
  teamId: text('team_id')
    .references(() => teams.id, { onDelete: 'cascade' })
    .notNull(),
  userId: text('user_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Tasks table for team task management across To Do, In Progress, and Completed.
 */
export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  teamId: text('team_id')
    .references(() => teams.id, { onDelete: 'cascade' })
    .notNull(),
  createdBy: text('created_by')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  assignedTo: text('assigned_to').references(() => profiles.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  description: text('description').default('').notNull(),
  status: text('status').default('todo').notNull(), // 'todo' | 'in_progress' | 'completed'
  priority: text('priority').default('medium').notNull(), // 'low' | 'medium' | 'high'
  dueDate: text('due_date').default('').notNull(), // Optional YYYY-MM-DD
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const profilesRelations = relations(profiles, ({ many }) => ({
  ownedTeams: many(teams),
  memberships: many(teamMembers),
  standupUpdates: many(standupUpdates),
  chatMessages: many(chatMessages),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [teams.ownerId],
    references: [profiles.id],
  }),
  members: many(teamMembers),
  updates: many(standupUpdates),
  messages: many(chatMessages),
  tasks: many(tasks),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(profiles, {
    fields: [teamMembers.userId],
    references: [profiles.id],
  }),
}));

export const standupUpdatesRelations = relations(standupUpdates, ({ one }) => ({
  team: one(teams, {
    fields: [standupUpdates.teamId],
    references: [teams.id],
  }),
  author: one(profiles, {
    fields: [standupUpdates.userId],
    references: [profiles.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  team: one(teams, {
    fields: [chatMessages.teamId],
    references: [teams.id],
  }),
  author: one(profiles, {
    fields: [chatMessages.userId],
    references: [profiles.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  team: one(teams, {
    fields: [tasks.teamId],
    references: [teams.id],
  }),
  creator: one(profiles, {
    fields: [tasks.createdBy],
    references: [profiles.id],
  }),
  assignee: one(profiles, {
    fields: [tasks.assignedTo],
    references: [profiles.id],
  }),
}));
