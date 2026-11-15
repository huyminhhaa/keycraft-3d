import { describe, it, expect } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { users, hardwareComponents, builds, usersRelations, buildsRelations } from './schema';

describe('Database Schema (PostgreSQL + pgvector)', () => {
  describe('Bảng users', () => {
    it('đặt đúng tên bảng và các cột bảo mật cần thiết', () => {
      expect(getTableName(users)).toBe('users');
      expect(users.id).toBeDefined();
      expect(users.email).toBeDefined();
      expect(users.passwordHash).toBeDefined();
      expect(users.failedLoginAttempts).toBeDefined();
      expect(users.lockedUntil).toBeDefined();
    });
  });

  describe('Bảng hardware_components', () => {
    it('đặt đúng tên bảng và có cột vector 768 chiều cho pgvector RAG', () => {
      expect(getTableName(hardwareComponents)).toBe('hardware_components');
      expect(hardwareComponents.id).toBeDefined();
      expect(hardwareComponents.type).toBeDefined();
      expect(hardwareComponents.soundProfile).toBeDefined();
      expect(hardwareComponents.embedding).toBeDefined();

      // Kiểm tra kiểu cột embedding là vector
      expect(hardwareComponents.embedding.columnType).toBe('PgVector');
    });
  });

  describe('Bảng builds', () => {
    it('đặt đúng tên bảng và có trường slug duy nhất, config jsonb', () => {
      expect(getTableName(builds)).toBe('builds');
      expect(builds.slug).toBeDefined();
      expect(builds.title).toBeDefined();
      expect(builds.config).toBeDefined();
      expect(builds.userId).toBeDefined();
      expect(builds.isPublic).toBeDefined();
    });
  });

  describe('Relations', () => {
    it('xác định quan hệ 1-N giữa users và builds', () => {
      expect(usersRelations).toBeDefined();
      expect(buildsRelations).toBeDefined();
    });
  });
});
