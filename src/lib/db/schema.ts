import { boolean, index, json, pgTable, real, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const colourmapUserState = pgTable(
  'colourmap_user_state',
  {
    id: text('id').primaryKey().notNull(),
    ownerId: text('owner_id').notNull(),
    healthAttention: real('health_attention').notNull(),
    healthTone: json('health_tone').notNull().default([]),
    healthAlignment: real('health_alignment').notNull().default(0.5),
    healthTensions: json('health_tensions').notNull().default([]),
    loveAttention: real('love_attention').notNull(),
    loveTone: json('love_tone').notNull().default([]),
    loveAlignment: real('love_alignment').notNull().default(0.5),
    loveTensions: json('love_tensions').notNull().default([]),
    purposeAttention: real('purpose_attention').notNull(),
    purposeTone: json('purpose_tone').notNull().default([]),
    purposeAlignment: real('purpose_alignment').notNull().default(0.5),
    purposeTensions: json('purpose_tensions').notNull().default([]),
    energy: real('energy').notNull(),
    clarity: real('clarity').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.ownerId)],
);

export const colourmapSessions = pgTable(
  'colourmap_sessions',
  {
    id: text('id').primaryKey().notNull(),
    ownerId: text('owner_id').notNull(),
    summary: text('summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.ownerId), index().on(t.ownerId, t.createdAt)],
);

export const colourmapMessages = pgTable(
  'colourmap_messages',
  {
    id: text('id').primaryKey().notNull(),
    sessionId: text('session_id').notNull(),
    role: text('role').notNull(),
    content: text('content').notNull(),
    stateDeltas: json('state_deltas'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.sessionId), index().on(t.sessionId, t.createdAt)],
);

export const colourmapPractices = pgTable(
  'colourmap_practices',
  {
    id: text('id').primaryKey().notNull(),
    ownerId: text('owner_id').notNull(),
    spaceKey: text('space_key').notNull(),
    title: text('title').notNull(),
    suggestedBy: text('suggested_by').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.ownerId), index().on(t.ownerId, t.spaceKey)],
);

export const colourmapValues = pgTable(
  'colourmap_values',
  {
    id: text('id').primaryKey().notNull(),
    ownerId: text('owner_id').notNull(),
    spaceKey: text('space_key').notNull(),
    text: text('text').notNull(),
    source: text('source').notNull(),
    confirmed: boolean('confirmed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.ownerId), index().on(t.ownerId, t.spaceKey)],
);

export const colourmapFocusItems = pgTable(
  'colourmap_focus_items',
  {
    id: text('id').primaryKey().notNull(),
    ownerId: text('owner_id').notNull(),
    spaceKey: text('space_key').notNull(),
    text: text('text').notNull(),
    source: text('source').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index().on(t.ownerId), index().on(t.ownerId, t.spaceKey)],
);

export const colourmapCompassReadings = pgTable(
  'colourmap_compass_readings',
  {
    id: text('id').primaryKey().notNull(),
    ownerId: text('owner_id').notNull(),
    narrative: text('narrative').notNull(),
    reinforcements: json('reinforcements').notNull().default([]),
    tensions: json('tensions').notNull().default([]),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
  },
  (t) => [index().on(t.ownerId), index().on(t.ownerId, t.generatedAt)],
);

export const colourmapPatternFlags = pgTable(
  'colourmap_pattern_flags',
  {
    id: text('id').primaryKey().notNull(),
    ownerId: text('owner_id').notNull(),
    description: text('description').notNull(),
    confidence: real('confidence').notNull(),
    spaceKey: text('space_key'),
    status: text('status').notNull().default('pending'),
    firstObserved: timestamp('first_observed', { withTimezone: true }).notNull(),
    lastRelevant: timestamp('last_relevant', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.ownerId), index().on(t.ownerId, t.status)],
);
