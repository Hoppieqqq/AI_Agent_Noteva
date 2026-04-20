import React from 'react'
import type { ChatMessage } from '../types'

interface ChatMessagesPanelProps {
  messages: ChatMessage[]
  contextLabel: string
  memoryEnabled: boolean
}

const getRoleLabel = (role: ChatMessage['role']): string => {
  if (role === 'user') {
    return 'You'
  }
  if (role === 'assistant') {
    return 'Agent'
  }
  if (role === 'tool') {
    return 'Tool'
  }
  return 'System'
}

export const ChatMessagesPanel = ({ messages, contextLabel, memoryEnabled }: ChatMessagesPanelProps): React.JSX.Element => {
  return (
    <div className="noteva-ai-messages">
      <div className="noteva-ai-context-banner">
        <strong>Context:</strong> {contextLabel} <span aria-hidden="true">·</span> <strong>Memory:</strong> {memoryEnabled ? 'on' : 'off'}
      </div>
      {messages.length === 0 ? (
        <div className="noteva-ai-empty-state">Ask about the current note, backlinks, linked notes, or the wider vault graph.</div>
      ) : null}
      {messages.map((message) => (
        <article
          key={message.id}
          className={`noteva-ai-message noteva-ai-message--${message.role}${message.role === 'user' ? ' noteva-ai-message--user' : ''}`}
        >
          <header className="noteva-ai-message-header">
            <strong>{getRoleLabel(message.role)}</strong>
            <small>{new Date(message.createdAt).toLocaleTimeString()}</small>
          </header>
          <div className="noteva-ai-message-content">{message.content || '...'}</div>
          {message.toolName ? <footer className="noteva-ai-message-footer">Tool: {message.toolName}</footer> : null}
          {message.model ? <footer className="noteva-ai-message-footer">Model: {message.model}</footer> : null}
        </article>
      ))}
    </div>
  )
}
