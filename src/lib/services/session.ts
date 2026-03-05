import { listSessions, loadSessionMessages, updateSessionSummary } from '@/lib/db/queries';
import { generateSessionSummary } from './coach';

export async function getOrGenerateSessionSummary(
  sessionId: string,
  ownerId: string,
): Promise<string | null> {
  const sessions = await listSessions(ownerId);
  const existing = sessions.find((s) => s.id === sessionId);

  const isCorrupted =
    existing?.summary &&
    (existing.summary.includes('---') ||
      existing.summary.includes('**Summary:**') ||
      existing.summary.length > 200);

  if (existing?.summary && !isCorrupted) {
    return existing.summary;
  }

  const messages = await loadSessionMessages(sessionId);
  if (messages.length < 2) return null;

  const summary = await generateSessionSummary(messages);
  await updateSessionSummary(sessionId, summary);
  return summary;
}
