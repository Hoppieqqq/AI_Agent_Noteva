import React from 'react'
import type { MemoryFact } from '../types'

interface MemoryPanelProps {
  facts: MemoryFact[]
  enabled: boolean
  onAdd: () => void
  onEdit: (factId: string) => void
  onDelete: (factId: string) => void
  onClear: () => void
}

export const MemoryPanel = ({ facts, enabled, onAdd, onEdit, onDelete, onClear }: MemoryPanelProps): React.JSX.Element => {
  return (
    <aside className="noteva-ai-memory-panel">
      <div className="noteva-ai-memory-header">
        <div>
          <strong>Memory</strong>
          <div className="noteva-ai-memory-subtitle">{enabled ? 'Used in every prompt' : 'Disabled in settings'}</div>
        </div>
        <button type="button" className="mod-cta" onClick={onAdd}>
          Add
        </button>
      </div>

      <div className="noteva-ai-memory-list">
        {facts.length === 0 ? (
          <div className="noteva-ai-memory-empty">No memory facts yet. Save stable preferences, projects, or constraints here.</div>
        ) : null}

        {facts.map((fact) => (
          <article key={fact.id} className="noteva-ai-memory-item">
            <div className="noteva-ai-memory-item-meta">
              <span>{fact.source === 'manual' ? 'Manual' : 'Extracted'}</span>
              <small>{new Date(fact.updatedAt).toLocaleString()}</small>
            </div>
            <div className="noteva-ai-memory-item-text">{fact.fact}</div>
            <div className="noteva-ai-memory-item-actions">
              <button type="button" onClick={() => onEdit(fact.id)}>
                Edit
              </button>
              <button type="button" onClick={() => onDelete(fact.id)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="noteva-ai-memory-footer">
        <button type="button" onClick={onClear} disabled={facts.length === 0}>
          Clear memory
        </button>
      </div>
    </aside>
  )
}
