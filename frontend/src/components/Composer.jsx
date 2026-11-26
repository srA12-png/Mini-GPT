import { useRef } from 'react';

const MODES = [
  { id: 'auto', label: 'Auto' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'document', label: 'Document' },
  { id: 'neural', label: 'Neural (Exp.)' },
];

export function Composer({
  value,
  onChange,
  mode,
  onModeChange,
  onSubmit,
  disabled,
  isLoading,
}) {
  const textareaRef = useRef(null);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isLoading && value.trim()) {
        onSubmit();
      }
    }
  }

  function handleInput(e) {
    onChange(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }
  }

  const canSend = !disabled && !isLoading && value.trim().length > 0;

  return (
    <div className="composer-wrapper">
      <div className="composer-inner">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          rows={1}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask MiniGPT a question... (Enter to send, Shift+Enter for new line)"
          disabled={isLoading}
          aria-label="Message input"
        />
        <div className="composer-toolbar">
          <div className="mode-selector" role="group" aria-label="Model mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`mode-pill ${mode === m.id ? 'active' : ''}`}
                onClick={() => onModeChange(m.id)}
                disabled={isLoading}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="composer-right">
            <span className="hint-text">Shift+Enter for new line</span>
            <button
              type="button"
              className="send-btn"
              onClick={onSubmit}
              disabled={!canSend}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
