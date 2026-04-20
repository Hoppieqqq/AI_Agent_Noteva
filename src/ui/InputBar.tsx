import React from 'react'

interface InputBarProps {
  value: string
  disabled: boolean
  isStreaming: boolean
  selectedModel: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
}

export const InputBar = ({ value, disabled, isStreaming, selectedModel, onChange, onSend, onStop }: InputBarProps): React.JSX.Element => {
  return (
    <div className="noteva-ai-inputbar">
      <div className="noteva-ai-input-wrap">
        <textarea
          placeholder="Ask about your notes, graph, links, or ideas..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault()
              if (isStreaming) {
                onStop()
              } else {
                onSend()
              }
            }
          }}
        />
        <div className="noteva-ai-input-meta">
          <span>Model: {selectedModel}</span>
          <span>{isStreaming ? 'Streaming response...' : 'Ctrl/Cmd+Enter to send'}</span>
        </div>
      </div>
      <div className="noteva-ai-inputbar-actions">
        <button className="mod-cta" type="button" onClick={isStreaming ? onStop : onSend}>
          {isStreaming ? 'Stop' : 'Send'}
        </button>
      </div>
    </div>
  )
}
