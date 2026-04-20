import React from 'react'
import type { ChatThread } from '../types'

interface ChatListPanelProps {
  chats: ChatThread[]
  activeChatId: string | null
  search: string
  onSearchChange: (value: string) => void
  onSelectChat: (chatId: string) => void
  onCreateChat: () => void
  onRenameChat: (chatId: string) => void
  onDeleteChat: (chatId: string) => void
  onDeleteAllChats: () => void
}

export const ChatListPanel = ({
  chats,
  activeChatId,
  search,
  onSearchChange,
  onSelectChat,
  onCreateChat,
  onRenameChat,
  onDeleteChat,
  onDeleteAllChats
}: ChatListPanelProps): React.JSX.Element => {
  return (
    <aside className="noteva-ai-agent-sidebar">
      <div className="noteva-ai-chatlist-header">
        <div className="noteva-ai-chatlist-header-row">
          <button className="mod-cta" type="button" onClick={onCreateChat}>
            New chat
          </button>
          <button type="button" onClick={onDeleteAllChats} disabled={chats.length === 0}>
            Clear all
          </button>
        </div>
        <input
          className="noteva-ai-search"
          type="search"
          placeholder="Search chats"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className="noteva-ai-chatlist">
        {chats.length === 0 ? <div className="noteva-ai-chatlist-empty">No chats yet. Start a new thread.</div> : null}
        {chats.map((chat) => (
          <div key={chat.id} className={`noteva-ai-chatlist-item${chat.id === activeChatId ? ' is-active' : ''}`}>
            <button type="button" className="noteva-ai-chatlist-trigger" onClick={() => onSelectChat(chat.id)}>
              <div>{chat.title}</div>
              <small>{new Date(chat.updatedAt).toLocaleString()}</small>
            </button>
            <div className="noteva-ai-chatlist-actions">
              <button type="button" onClick={() => onRenameChat(chat.id)}>
                Rename
              </button>
              <button type="button" onClick={() => onDeleteChat(chat.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
