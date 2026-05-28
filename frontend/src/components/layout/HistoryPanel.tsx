import { Loader2, Trash2, Clock } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useHistory, useClearHistory } from '../../hooks/useHistory'
import { useToast } from '../../lib/toast'
import type { HistorySummary } from '../../types/api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET:    'text-method-get',
  POST:   'text-method-post',
  PUT:    'text-method-put',
  PATCH:  'text-method-patch',
  DELETE: 'text-method-delete',
}

function statusColor(status?: number): string {
  if (!status) return 'text-subtle'
  if (status >= 500) return 'text-status-5xx'
  if (status >= 400) return 'text-status-4xx'
  if (status >= 300) return 'text-status-3xx'
  return 'text-status-2xx'
}

function displayUrl(url: string): string {
  try {
    const { hostname, pathname, search } = new URL(url)
    const path = pathname === '/' ? '' : pathname
    return hostname + path + search
  } catch {
    return url
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

// ─── History item ─────────────────────────────────────────────────────────────

function HistoryItem({
  item,
  onSelect,
}: {
  item: HistorySummary
  onSelect: (id: string) => void
}) {
  const methodColor = METHOD_COLORS[item.method] ?? 'text-subtle'

  return (
    <button
      onClick={() => onSelect(item.id)}
      className="w-full flex flex-col gap-0.5 px-2 py-1.5 rounded-sm text-left hover:bg-overlay transition-colors group cursor-pointer"
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={cn('font-mono font-semibold shrink-0 text-[10px] leading-none', methodColor)}>
          {item.method}
        </span>
        <span className="text-xs text-text truncate">{displayUrl(item.url)}</span>
      </div>
      <div className="flex items-center gap-2 pl-0.5">
        {item.responseStatus != null && (
          <span className={cn('font-mono text-[10px] font-semibold', statusColor(item.responseStatus))}>
            {item.responseStatus}
          </span>
        )}
        {item.durationMs != null && (
          <span className="text-[10px] text-subtle">{item.durationMs}ms</span>
        )}
        <span className="text-[10px] text-subtle ml-auto">{timeAgo(item.sentAt)}</span>
      </div>
    </button>
  )
}

// ─── History panel ────────────────────────────────────────────────────────────

interface Props {
  onHistorySelect: (id: string) => void
}

export function HistoryPanel({ onHistorySelect }: Props) {
  const toast = useToast()
  const { data: items = [], isLoading, isError } = useHistory()
  const { mutate: clearHistory, isPending: isClearing } = useClearHistory()

  function handleClear() {
    clearHistory(undefined, {
      onError: () => toast('Failed to clear history.'),
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-[10px] font-semibold text-subtle uppercase tracking-widest">History</span>
        {items.length > 0 && (
          <button
            onClick={handleClear}
            disabled={isClearing}
            title="Clear history"
            className="p-0.5 rounded hover:bg-overlay text-subtle hover:text-status-5xx transition-colors disabled:opacity-40 cursor-pointer"
          >
            {isClearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-xs text-subtle gap-2">
            <Loader2 size={13} className="animate-spin" />
            Loading…
          </div>
        )}

        {isError && (
          <p className="px-2 py-4 text-xs text-status-5xx text-center">Failed to load</p>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8">
            <Clock size={18} className="text-subtle" />
            <p className="text-xs text-subtle">No history yet</p>
          </div>
        )}

        {items.map((item) => (
          <HistoryItem key={item.id} item={item} onSelect={onHistorySelect} />
        ))}
      </div>
    </div>
  )
}
