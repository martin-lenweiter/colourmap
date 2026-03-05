import type { SpaceKey } from '../../domain/types';

export const DB_TO_SPACE: Record<string, SpaceKey> = {
  health: 'health',
  love: 'connection',
  purpose: 'purpose',
};

export const SPACE_TO_DB: Record<SpaceKey, string> = {
  health: 'health',
  connection: 'love',
  purpose: 'purpose',
};

export function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
  return [];
}

export function genId(): string {
  return crypto.randomUUID();
}
