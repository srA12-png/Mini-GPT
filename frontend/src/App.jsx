import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchHealth, sendChat } from './api/minigpt';
import { Composer } from './components/Composer';
import { MessageItem } from './components/MessageItem';
import { Sidebar } from './components/Sidebar';
import {
  clearStoredSessions,
  createSession,
  loadSessions,
  saveSessions,
} from './utils/storage';
import './App.css';

export default function App() {
  const [sessions, setSessions] = useState(() => {
    const saved = loadSessions();
    return saved.length > 0 ? saved : [createSession()];
  });
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = loadSessions();
    return saved.length > 0 ? saved[0].id : null;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [chatError, setChatError] = useState(null);

  const messagesEndRef = useRef(null);
  const inFlightRef = useRef(false);

  // Ensure activeSessionId always points to a valid session
  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? sessions[0];

  useEffect(() => {
    if (activeSession && activeSession.id !== activeSessionId) {
      setActiveSessionId(activeSession.id);
    }
  }, [activeSession, activeSessionId]);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  const checkHealth = useCallback(async () => {
    try {
      const data = await fetchHealth();
      setHealth(data);
      setHealthError(null);
    } catch (err) {
      setHealth(null);
      setHealthError(
        err?.message || 'Unable to reach MiniGPT backend at http://127.0.0.1:8000.'
      );
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const intervalId = setInterval(checkHealth, 30000);
    return () => clearInterval(intervalId);
  }, [checkHealth]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages?.length, isLoading]);

  function handleNewChat() {
    const next = createSession();
    setSessions((prev) => [next, ...prev]);
    setActiveSessionId(next.id);
    setChatError(null);
  }

  function handleSelectSession(id) {
    setActiveSessionId(id);
    setChatError(null);
  }

  function handleDeleteSession(id) {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      if (filtered.length === 0) {
        const fresh = createSession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (id === activeSession?.id) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  }

  function handleClearHistory() {
    clearStoredSessions();
    const fresh = createSession();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
    setChatError(null);
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading || inFlightRef.current || !activeSession) {
      return;
    }

    inFlightRef.current = true;
    setIsLoading(true);
    setChatError(null);

    const targetSessionId = activeSession.id;
    const sessionContext = activeSession.context ?? null;

    const userMsg = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    };

    setInput('');

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== targetSessionId) return s;
        const isFirst = s.messages.length === 0;
        const nextTitle = isFirst
          ? trimmed.slice(0, 42) + (trimmed.length > 42 ? '…' : '')
          : s.title;
        return {
          ...s,
          title: nextTitle,
          updatedAt: Date.now(),
          messages: [...s.messages, userMsg],
        };
      })
    );

    try {
      const data = await sendChat({
        message: trimmed,
        mode,
        context: sessionContext,
      });

      const assistantMsg = {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: data.response || 'No response generated.',
        mode: data.mode || mode,
        sources: Array.isArray(data.sources) ? data.sources : [],
        match_type: data.match_type ?? null,
        similarity: data.similarity ?? null,
        warning: data.warning ?? null,
        createdAt: Date.now(),
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== targetSessionId) return s;
          return {
            ...s,
            updatedAt: Date.now(),
            context: data.context !== undefined ? data.context : s.context,
            messages: [...s.messages, assistantMsg],
          };
        })
      );
    } catch (err) {
      setChatError(
        err?.message || 'Failed to get a response from the MiniGPT backend.'
      );
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }

  const messages = activeSession?.messages ?? [];

  return (
    <div className="app-shell">
      {!sidebarCollapsed && (
        <div
          className="mobile-backdrop"
          onClick={() => setSidebarCollapsed(true)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(true)}
        sessions={sessions}
        activeSessionId={activeSession?.id}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onClearHistory={handleClearHistory}
        health={health}
        healthError={healthError}
      />

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            {sidebarCollapsed && (
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Open sidebar"
                title="Open sidebar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              </button>
            )}
            <span className="topbar-title">
              {activeSession?.title || 'New Research Chat'}
            </span>
          </div>

          <div className="topbar-right">
            {healthError && (
              <button type="button" className="retry-btn" onClick={checkHealth}>
                Reconnect
              </button>
            )}
          </div>
        </header>

        {healthError && (
          <div className="offline-banner" role="alert">
            <span>
              Backend unavailable at <code>http://127.0.0.1:8000</code>. Start the
              FastAPI server to send messages.
            </span>
            <button type="button" className="retry-btn" onClick={checkHealth}>
              Retry
            </button>
          </div>
        )}

        {chatError && (
          <div className="offline-banner" role="alert">
            <span>{chatError}</span>
            <button
              type="button"
              className="retry-btn"
              onClick={() => setChatError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="messages-scroll">
          <div className="messages-inner">
            {messages.length === 0 ? (
              <div className="empty-state">
                <h2>MiniGPT Research Assistant</h2>
                <p>
                  Query your custom PyTorch Transformer, curated knowledge base, or
                  indexed documents. Select a mode below to begin.
                </p>
                <div className="mode-overview">
                  <div className="mode-overview-item">
                    <strong>Auto</strong>
                    <span>Routes follow-ups and defaults to knowledge retrieval.</span>
                  </div>
                  <div className="mode-overview-item">
                    <strong>Knowledge</strong>
                    <span>Searches structured knowledge entries.</span>
                  </div>
                  <div className="mode-overview-item">
                    <strong>Document</strong>
                    <span>Retrieves relevant document chunks with page citations.</span>
                  </div>
                  <div className="mode-overview-item">
                    <strong>Neural (Exp.)</strong>
                    <span>Direct generation from your trained GPT weights.</span>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => <MessageItem key={msg.id} message={msg} />)
            )}

            {isLoading && (
              <div className="loading-bubble" role="status" aria-live="polite">
                <span className="spinner" aria-hidden="true" />
                <span>Generating response...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <Composer
          value={input}
          onChange={setInput}
          mode={mode}
          onModeChange={setMode}
          onSubmit={handleSend}
          disabled={Boolean(healthError)}
          isLoading={isLoading}
        />
      </main>
    </div>
  );
}
