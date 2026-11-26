import { useState } from 'react';

export function MessageItem({ message }) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === 'assistant';
  const isNeural = message.mode === 'neural';

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API may be unavailable in some contexts
    }
  }

  return (
    <div className={`message-row ${message.role}`}>
      {isAssistant && (isNeural || message.warning) && (
        <div className="neural-warning" role="note">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span>
            {message.warning || 'Experimental neural-mode response; may be inaccurate.'}
          </span>
        </div>
      )}

      <div className="message-bubble">{message.content}</div>

      {isAssistant && Array.isArray(message.sources) && message.sources.length > 0 && (
        <div className="sources-grid" aria-label="Source references">
          {message.sources.map((src, idx) => {
            if (src.url) {
              return (
                <a
                  key={`${src.url}-${idx}`}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-card source-link"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                  </svg>
                  <span className="source-filename">{src.title || 'Wikipedia'}</span>
                  {src.attribution && (
                    <span className="source-attribution">{src.attribution}</span>
                  )}
                </a>
              );
            }

            const filename = src.filename || src.source || src.file || 'Document';
            const page = src.page ?? src.page_number;
            return (
              <div key={`${filename}-${page ?? idx}`} className="source-card">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
                <span className="source-filename">{filename}</span>
                {page !== undefined && page !== null && (
                  <span className="source-page">p. {page}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="message-meta">
        {isAssistant && message.mode && (
          <span className={`mode-badge ${isNeural ? 'neural' : ''}`}>
            {message.mode}
          </span>
        )}
        {isAssistant && typeof message.similarity === 'number' && (
          <span>sim: {message.similarity.toFixed(2)}</span>
        )}
        {isAssistant && (
          <button type="button" className="copy-btn" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}
