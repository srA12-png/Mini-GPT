const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://127.0.0.1:8000');

/**
 * Fetch backend health and model metadata.
 */
export async function fetchHealth(signal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Health check failed (${res.status})`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Send a chat message to the MiniGPT FastAPI backend.
 */
export async function sendChat({ message, mode, context }) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      mode,
      context: context ?? null,
    }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Ignore JSON parse error for non-JSON error responses
  }

  if (!res.ok) {
    const detail = data?.detail || `Request failed with status ${res.status}`;
    throw new Error(detail);
  }

  return data;
}
