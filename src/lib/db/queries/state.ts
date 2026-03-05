import { eq } from 'drizzle-orm';

import type { UserState } from '../../domain/types';
import { db } from '../client';
import { colourmapUserState } from '../schema';
import { genId, parseJsonArray } from './_shared';

export async function loadUserState(ownerId: string): Promise<UserState | null> {
  const [row] = await db
    .select()
    .from(colourmapUserState)
    .where(eq(colourmapUserState.ownerId, ownerId))
    .limit(1);
  if (!row) return null;

  return {
    health: {
      attention: row.healthAttention,
      tone: parseJsonArray(row.healthTone),
      alignment: row.healthAlignment,
      tensions: parseJsonArray(row.healthTensions),
    },
    connection: {
      attention: row.loveAttention,
      tone: parseJsonArray(row.loveTone),
      alignment: row.loveAlignment,
      tensions: parseJsonArray(row.loveTensions),
    },
    purpose: {
      attention: row.purposeAttention,
      tone: parseJsonArray(row.purposeTone),
      alignment: row.purposeAlignment,
      tensions: parseJsonArray(row.purposeTensions),
    },
    energy: row.energy,
    clarity: row.clarity,
  };
}

export async function saveUserState(ownerId: string, state: UserState): Promise<void> {
  const values = {
    id: genId(),
    ownerId,
    healthAttention: state.health.attention,
    healthTone: state.health.tone,
    healthAlignment: state.health.alignment,
    healthTensions: state.health.tensions,
    loveAttention: state.connection.attention,
    loveTone: state.connection.tone,
    loveAlignment: state.connection.alignment,
    loveTensions: state.connection.tensions,
    purposeAttention: state.purpose.attention,
    purposeTone: state.purpose.tone,
    purposeAlignment: state.purpose.alignment,
    purposeTensions: state.purpose.tensions,
    energy: state.energy,
    clarity: state.clarity,
  };

  await db
    .insert(colourmapUserState)
    .values(values)
    .onConflictDoUpdate({
      target: colourmapUserState.ownerId,
      set: {
        healthAttention: values.healthAttention,
        healthTone: values.healthTone,
        healthAlignment: values.healthAlignment,
        healthTensions: values.healthTensions,
        loveAttention: values.loveAttention,
        loveTone: values.loveTone,
        loveAlignment: values.loveAlignment,
        loveTensions: values.loveTensions,
        purposeAttention: values.purposeAttention,
        purposeTone: values.purposeTone,
        purposeAlignment: values.purposeAlignment,
        purposeTensions: values.purposeTensions,
        energy: values.energy,
        clarity: values.clarity,
        updatedAt: new Date(),
      },
    });
}
