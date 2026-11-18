import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  vector,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { KeyboardState, SoundProfile } from '@/types/keyboard';

export interface StoredAttachmentMeta {
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'pdf' | 'text';
}

export interface StoredToolExecution {
  id: string;
  toolName: string;
  summary: string;
  input: Record<string, unknown>;
}

// ==============================================================================
// 1. Bảng Users: Quản lý tài khoản, mật khẩu mã hoá, OAuth & Chống Brute-force
// ==============================================================================
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'), // Nullable cho người dùng đăng nhập qua Google/GitHub OAuth
  avatarUrl: text('avatar_url'),
  authProvider: varchar('auth_provider', { length: 20 }).default('credentials').notNull(), // 'credentials' | 'google'
  googleId: varchar('google_id', { length: 128 }).unique(),
  role: varchar('role', { length: 20 }).default('user').notNull(),

  // Trường hỗ trợ cơ chế bảo mật Brute-force Protection
  failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  builds: many(builds),
  chatSessions: many(chatSessions),
}));

// ==============================================================================
// 2. Bảng Hardware Components: Linh kiện phần cứng kèm Vector RAG (768 chiều)
// ==============================================================================
export const hardwareComponents = pgTable('hardware_components', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 30 }).notNull(), // 'plate' | 'switch' | 'case' | 'keycap' | 'foam'
  name: varchar('name', { length: 100 }).notNull(),
  material: varchar('material', { length: 50 }),
  acousticDescription: text('acoustic_description'), // Mô tả âm học chi tiết (dùng tạo vector embedding)

  // Đặc tính âm học cấu trúc chuẩn: pitch, damping, resonance
  soundProfile: jsonb('sound_profile').$type<SoundProfile>().notNull(),

  // Thông số kỹ thuật bổ sung (lực nhấn switch, độ dày plate, profile keycap)
  specs: jsonb('specs').$type<Record<string, unknown>>().default({}),

  // Cột Vector 768 chiều cho Semantic Search (pgvector) khớp với Google Gemini Embedding
  embedding: vector('embedding', { dimensions: 768 }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==============================================================================
// 3. Bảng Builds: Lưu cấu hình 3D hoàn chỉnh dạng JSONB + Slug chia sẻ
// ==============================================================================
export const builds = pgTable('builds', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 120 }).notNull().unique(), // URL chia sẻ: /build/deep-thock-custom-75
  title: varchar('title', { length: 150 }).notNull(),
  description: text('description'),

  // Liên kết người dùng sở hữu bản build (nullable nếu là build ẩn danh)
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),

  // Cấu hình 3D toàn vẹn (layout, materials, switches, colors, RGB)
  config: jsonb('config').$type<KeyboardState>().notNull(),

  // Thống kê tương tác
  viewCount: integer('view_count').default(0).notNull(),
  forkCount: integer('fork_count').default(0).notNull(),
  isPublic: boolean('is_public').default(true).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const buildsRelations = relations(builds, ({ one }) => ({
  user: one(users, {
    fields: [builds.userId],
    references: [users.id],
  }),
}));

// ==============================================================================
// 4. Bảng Chat Sessions & Messages: Lịch sử AI Chat đa luồng cho user đăng nhập
// ==============================================================================
export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .references(() => chatSessions.id, { onDelete: 'cascade' })
    .notNull(),
  role: varchar('role', { length: 20 }).notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  // Chỉ lưu metadata an toàn (name, mimeType, size, kind) — KHÔNG lưu binary thô vào DB
  attachments: jsonb('attachments').$type<StoredAttachmentMeta[]>().default([]).notNull(),
  toolExecutions: jsonb('tool_executions').$type<StoredToolExecution[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type HardwareComponent = typeof hardwareComponents.$inferSelect;
export type NewHardwareComponent = typeof hardwareComponents.$inferInsert;

export type Build = typeof builds.$inferSelect;
export type NewBuild = typeof builds.$inferInsert;

export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;

export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type NewChatMessageRow = typeof chatMessages.$inferInsert;
