import { useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { AlertCircle, Copy, Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import { StatusBadge } from './StatusBadge'
import type { ExecuteResponse } from '../../types/api'

type ResponseTab = 'body' | 'headers'

const TABS: Array<{ id: ResponseTab; label: string }> = [
  { id: 'body',    label: 'Body' },
  { id: 'headers', label: 'Headers' },
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function prettyJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2) }
  catch { return raw }
}

interface Props {
  response: ExecuteResponse | null
  error?: string | null
  isExecuting: boolean
  activeTab: ResponseTab
  onTabChange: (tab: ResponseTab) => void
  sentAt?: Date | null
}

export function ResponsePanel({ response, error, isExecuting, activeTab, onTabChange, sentAt }: Props) {
  if (isExecuting) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Sending…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center select-none px-6">
        <div className="flex flex-col items-center gap-2 text-center max-w-sm">
          <AlertCircle size={16} className="text-status-5xx shrink-0" />
          <p className="text-xs font-medium text-muted">Request failed</p>
          <p className="text-xs text-subtle font-mono break-all">{error}</p>
        </div>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="flex h-full items-center justify-center select-none">
        <div className="text-center space-y-1.5">
          <p className="text-xs font-medium text-muted">No response yet</p>
          <p className="text-xs text-subtle">Press Send or ⌘↵ to run the request</p>
        </div>
      </div>
    )
  }

  const { status, statusText, durationMs, bodySize, body, headers } = response.response

  const [copied, setCopied] = useState(false)
  function handleCopy() {
    if (!body) return
    navigator.clipboard.writeText(prettyJson(body))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Meta bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border shrink-0">
        <StatusBadge status={status} statusText={statusText} />
        <span className="text-xs font-mono text-muted">{formatDuration(durationMs)}</span>
        <span className="text-subtle text-xs">·</span>
        <span className="text-xs font-mono text-muted">{formatBytes(bodySize)}</span>
        {sentAt && (
          <>
            <span className="text-subtle text-xs">·</span>
            <span className="text-xs text-muted">
              Sent at <span className="font-mono">{sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </span>
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs.Root
        value={activeTab}
        onValueChange={(v) => onTabChange(v as ResponseTab)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <Tabs.List className="flex items-center border-b border-border px-3 shrink-0">
          {TABS.map((tab) => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              className={cn(
                'px-3 py-2.5 text-xs font-medium transition-colors relative select-none cursor-pointer',
                'text-subtle hover:text-muted',
                'data-[state=active]:text-text',
                'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px',
                'after:bg-accent after:scale-x-0 data-[state=active]:after:scale-x-100',
                'after:transition-transform after:duration-150',
                'outline-none',
              )}
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
          {body && (
            <div className="ml-auto">
              <button
                onClick={handleCopy}
                title="Copy to clipboard"
                className={cn(
                  'flex items-center gap-1.5 h-6 px-2 rounded text-[10px] transition-colors cursor-pointer',
                  copied
                    ? 'text-green-400 bg-green-400/10'
                    : 'text-subtle hover:text-text hover:bg-overlay',
                )}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Response body copied!' : 'Copy'}
              </button>
            </div>
          )}
        </Tabs.List>

        <Tabs.Content value="body" className="flex-1 overflow-auto">
          {body ? (
            <pre className="p-4 text-xs font-mono text-text leading-relaxed whitespace-pre-wrap break-all">
              {prettyJson(body)}
            </pre>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-subtle">Empty body</div>
          )}
        </Tabs.Content>

        <Tabs.Content value="headers" className="flex-1 overflow-auto">
          <div className="divide-y divide-border/50">
            {Object.entries(headers).map(([key, value]) => (
              <div key={key} className="grid grid-cols-[200px_1fr] gap-4 px-4 py-2">
                <span className="text-xs font-mono text-muted truncate">{key}</span>
                <span className="text-xs font-mono text-text break-all">{value}</span>
              </div>
            ))}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
