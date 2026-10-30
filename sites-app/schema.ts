import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('login_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  csrf: text('csrf').notNull(),
  expires: integer('expires').notNull(),
  passwordVersion: text('password_version').notNull(),
});

export const limits = sqliteTable('login_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expires: integer('expires').notNull(),
});
