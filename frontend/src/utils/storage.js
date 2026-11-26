const STORAGE_KEY = 'minigpt_sessions_v1';

export function createSession() {
  const now = Date.now();
  return {
    id: `chat_${now}_${Math.random().toString(36).slice(2, 8)}`,
    title: 'New Research Chat',
    createdAt: now,
    updatedAt: now,
    context: null,
    messages: [],
  };
}

export function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearStoredSessions() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function formatParameters(count) {
  if (typeof count !== 'number' || Number.isNaN(count)) return '—';
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(2)}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}
