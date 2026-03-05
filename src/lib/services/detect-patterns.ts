import {
  createPatternFlag,
  listPatternFlags,
  loadMessageDeltasForSessions,
  loadSessionsForPatternDetection,
} from '../db/queries';
import { SPACE_KEYS } from '../domain/state';
import type { SpaceKey } from '../domain/types';

const MIN_DAYS = 56; // 8 weeks
const CONFIDENCE_THRESHOLD = 0.6;

interface SessionAggregate {
  sessionId: string;
  createdAt: Date;
  dominantSpace: SpaceKey;
  avgAttention: Record<SpaceKey, number>;
  avgAlignment: Record<SpaceKey, number>;
}

export interface DetectedPattern {
  description: string;
  confidence: number;
  spaceKey: SpaceKey | null;
  firstObserved: Date;
  lastRelevant: Date;
}

const DB_SPACE_MAP: Record<string, SpaceKey> = {
  health: 'health',
  love: 'connection',
  connection: 'connection',
  purpose: 'purpose',
};

export async function detectPatterns(ownerId: string): Promise<DetectedPattern[]> {
  const since = new Date(Date.now() - MIN_DAYS * 24 * 60 * 60 * 1000);

  const allSessions = await loadSessionsForPatternDetection(ownerId, since);

  if (allSessions.length < 4) return [];

  const sessionIds = allSessions.map((s) => s.id);
  const messages = await loadMessageDeltasForSessions(sessionIds);

  const aggregates: SessionAggregate[] = [];

  for (const session of allSessions) {
    const sessionMsgs = messages.filter((m) => m.sessionId === session.id);
    if (sessionMsgs.length === 0) continue;

    const attentionSums: Record<SpaceKey, number> = { health: 0, connection: 0, purpose: 0 };
    const alignmentSums: Record<SpaceKey, number> = { health: 0, connection: 0, purpose: 0 };
    const counts: Record<SpaceKey, number> = { health: 0, connection: 0, purpose: 0 };

    for (const msg of sessionMsgs) {
      const deltas = msg.stateDeltas as Record<string, Record<string, unknown>> | null;
      if (!deltas) continue;

      for (const [k, v] of Object.entries(deltas)) {
        const spaceKey = (SPACE_KEYS.includes(k as SpaceKey) ? k : DB_SPACE_MAP[k]) as
          | SpaceKey
          | undefined;
        if (!spaceKey) continue;
        const sd = v as Record<string, unknown>;
        if (typeof sd?.attention === 'number') {
          attentionSums[spaceKey] += sd.attention;
          counts[spaceKey]++;
        }
        if (typeof sd?.alignment === 'number') {
          alignmentSums[spaceKey] += sd.alignment;
          if (!counts[spaceKey]) counts[spaceKey] = 1;
        }
      }
    }

    const avgAttention: Record<SpaceKey, number> = { health: 0.3, connection: 0.3, purpose: 0.3 };
    const avgAlignment: Record<SpaceKey, number> = { health: 0.5, connection: 0.5, purpose: 0.5 };
    for (const k of SPACE_KEYS) {
      if (counts[k] > 0) {
        avgAttention[k] = Math.round((attentionSums[k] / counts[k]) * 100) / 100;
        avgAlignment[k] = Math.round((alignmentSums[k] / counts[k]) * 100) / 100;
      }
    }

    let dominantSpace: SpaceKey = 'health';
    let maxAttn = 0;
    for (const k of SPACE_KEYS) {
      if (avgAttention[k] > maxAttn) {
        maxAttn = avgAttention[k];
        dominantSpace = k;
      }
    }

    aggregates.push({
      sessionId: session.id,
      createdAt: session.createdAt,
      dominantSpace,
      avgAttention,
      avgAlignment,
    });
  }

  if (aggregates.length < 4) return [];

  const patterns: DetectedPattern[] = [];
  const n = aggregates.length;
  const firstAgg = aggregates[0];
  const lastAgg = aggregates[aggregates.length - 1];
  if (!firstAgg || !lastAgg) return patterns;

  // Consistently dominant space (>= 60% of sessions)
  const dominantCounts: Record<SpaceKey, number> = { health: 0, connection: 0, purpose: 0 };
  for (const a of aggregates) dominantCounts[a.dominantSpace]++;
  for (const k of SPACE_KEYS) {
    if (dominantCounts[k] >= Math.ceil(n * 0.6)) {
      const confidence = Math.min(0.95, 0.6 + (dominantCounts[k] / n) * 0.3);
      if (confidence >= CONFIDENCE_THRESHOLD) {
        const spaceLabel = k === 'connection' ? 'love' : k;
        patterns.push({
          description: `${spaceLabel} is consistently the dominant focus`,
          confidence,
          spaceKey: k,
          firstObserved: firstAgg.createdAt,
          lastRelevant: lastAgg.createdAt,
        });
      }
    }
  }

  // Persistently low alignment
  for (const k of SPACE_KEYS) {
    const alignments = aggregates.map((a) => a.avgAlignment[k]).filter((x) => x > 0);
    if (alignments.length < 3) continue;
    const avgAlign = alignments.reduce((s, x) => s + x, 0) / alignments.length;
    if (avgAlign < 0.35) {
      const confidence = Math.min(0.9, 0.7 + (0.35 - avgAlign) * 0.5);
      if (confidence >= CONFIDENCE_THRESHOLD) {
        const spaceLabel = k === 'connection' ? 'love' : k;
        patterns.push({
          description: `${spaceLabel} alignment is persistently low`,
          confidence,
          spaceKey: k,
          firstObserved: firstAgg.createdAt,
          lastRelevant: lastAgg.createdAt,
        });
      }
    }
  }

  // Engagement trending up or down
  if (n >= 4) {
    const third = Math.ceil(n / 3);
    const first = aggregates.slice(0, third);
    const last = aggregates.slice(-third);
    const firstEnergy =
      first.reduce((s, a) => s + SPACE_KEYS.reduce((t, k) => t + a.avgAttention[k], 0), 0) /
      (first.length * 3);
    const lastEnergy =
      last.reduce((s, a) => s + SPACE_KEYS.reduce((t, k) => t + a.avgAttention[k], 0), 0) /
      (last.length * 3);
    const diff = lastEnergy - firstEnergy;
    if (diff > 0.15) {
      patterns.push({
        description: 'overall engagement is trending up',
        confidence: Math.min(0.9, 0.65 + diff * 0.8),
        spaceKey: null,
        firstObserved: firstAgg.createdAt,
        lastRelevant: lastAgg.createdAt,
      });
    } else if (diff < -0.15) {
      patterns.push({
        description: 'overall engagement is trending down',
        confidence: Math.min(0.9, 0.65 + Math.abs(diff) * 0.8),
        spaceKey: null,
        firstObserved: firstAgg.createdAt,
        lastRelevant: lastAgg.createdAt,
      });
    }
  }

  return patterns.filter((p) => p.confidence >= CONFIDENCE_THRESHOLD);
}

export async function detectAndPersistPatterns(ownerId: string): Promise<DetectedPattern[]> {
  const detected = await detectPatterns(ownerId);
  if (detected.length === 0) return detected;

  const existing = await listPatternFlags(ownerId);
  const existingDescs = new Set(existing.map((f) => f.description));

  for (const p of detected) {
    if (!existingDescs.has(p.description)) {
      await createPatternFlag(ownerId, {
        description: p.description,
        confidence: p.confidence,
        spaceKey: p.spaceKey,
        firstObserved: p.firstObserved,
        lastRelevant: p.lastRelevant,
      });
      existingDescs.add(p.description);
    }
  }

  return detected;
}
