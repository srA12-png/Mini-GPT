import { formatParameters } from '../utils/storage';

export function Sidebar({
  collapsed,
  onToggleCollapse,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onClearHistory,
  health,
  healthError,
}) {
  const isOnline = Boolean(health && health.status === 'ok' && !healthError);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            MG
          </div>
          <div className="brand-text">
            <h1>MiniGPT</h1>
            <span>Research Assistant</span>
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleCollapse}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <div className="sidebar-actions">
        <button type="button" className="new-chat-btn" onClick={onNewChat}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Chat
        </button>
      </div>

      <div className="history-section">
        <div className="history-label">Conversations</div>
        {sessions.length === 0 ? (
          <div className="history-empty">No saved conversations yet.</div>
        ) : (
          <ul className="history-list">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <li key={session.id} className={`history-item ${isActive ? 'active' : ''}`}>
                  <button
                    type="button"
                    className="history-select-btn"
                    onClick={() => onSelectSession(session.id)}
                    title={session.title}
                  >
                    {session.title}
                  </button>
                  <button
                    type="button"
                    className="history-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    aria-label={`Delete ${session.title}`}
                    title="Delete conversation"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="model-card">
          <div className="model-card-header">
            <span className="model-card-title">Model Status</span>
            <span className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
              <span className="status-dot" />
              {isOnline ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div className="model-stats">
            <div className="stat-item">
              <span className="stat-label">Parameters</span>
              <span className="stat-value">
                {health ? formatParameters(health.parameters) : '—'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Device</span>
              <span className="stat-value">{health?.device ?? '—'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Knowledge</span>
              <span className="stat-value">
                {typeof health?.knowledge_entries === 'number' ? health.knowledge_entries : '—'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Doc Chunks</span>
              <span className="stat-value">
                {typeof health?.document_chunks === 'number' ? health.document_chunks : '—'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="clear-history-btn"
          onClick={onClearHistory}
          disabled={sessions.length === 0}
        >
          Clear Conversation History
        </button>
      </div>
    </aside>
  );
}
