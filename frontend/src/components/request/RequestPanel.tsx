import { useRef, useEffect, useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Send, Lock } from 'lucide-react'
import { cn } from '../../lib/utils'
import { MethodSelector } from './MethodSelector'
import { KeyValueEditor } from './KeyValueEditor'
import { BodyEditor } from './BodyEditor'
import { AuthPanel } from './AuthPanel'
import { SaveRequestDialog } from './SaveRequestDialog'
import { parseSegments, hasVariables, resolveVars } from '../../lib/variables'
import type { HttpMethod, KeyValue, SavedRequest, AuthConfig } from '../../types/api'

type RequestTab = 'params' | 'headers' | 'body' | 'auth'

const ALL_TABS: Array<{ id: RequestTab; label: string; hideFor?: HttpMethod[] }> = [
  { id: 'params',  label: 'Params' },
  { id: 'headers', label: 'Headers' },
  { id: 'body',    label: 'Body', hideFor: ['GET', 'DELETE'] },
  { id: 'auth',    label: 'Auth' },
]

interface Props {
  method: HttpMethod
  url: string
  params: KeyValue[]
  headers: KeyValue[]
  body: string
  bodyType: 'NONE' | 'JSON' | 'FORM' | 'TEXT'
  auth: AuthConfig
  savedAuth: AuthConfig
  collectionAuth?: AuthConfig | null
  activeTab: RequestTab
  activeRequest: SavedRequest | null
  isDirty: boolean
  envVariables: Record<string, string>
  onMethodChange: (m: HttpMethod) => void
  onUrlChange: (url: string) => void
  onParamsChange: (rows: KeyValue[]) => void
  onHeadersChange: (rows: KeyValue[]) => void
  onBodyChange: (body: string) => void
  onBodyTypeChange: (type: 'NONE' | 'JSON' | 'FORM' | 'TEXT') => void
  onAuthChange: (auth: AuthConfig) => void
  onTabChange: (tab: RequestTab) => void
  onSend: () => void
  onSaved: (saved: SavedRequest) => void
}


function isValidUrl(url: string, vars: Record<string, string> = {}): boolean {
  if (!url.trim() || url === 'https://' || url === 'http://') return false
  // Resolve variables before validating — unknown vars get a safe placeholder
  const resolved = resolveVars(url, vars).replace(/\{\{(\w+)}}/g, 'placeholder')
  try {
    const { protocol, hostname } = new URL(resolved)
    if (protocol !== 'http:' && protocol !== 'https:') return false
    const host = hostname.replace(/\.+$/, '')
    if (!host) return false
    if (host === 'localhost') return true
    // IPv4
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return true
    // IPv6 (browser wraps in brackets; URL hostname strips them)
    if (host.includes(':')) return true
    // Domain: two or more labels, each non-empty with only alphanumeric/hyphens
    const labels = host.split('.')
    return labels.length >= 2 && labels.every((l) => /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(l))
  } catch {
    return false
  }
}

export function RequestPanel({
  method, url, params, headers, body, bodyType, auth, collectionAuth, activeTab, activeRequest, isDirty, envVariables,
  onMethodChange, onUrlChange, onParamsChange, onHeadersChange,
  onBodyChange, onBodyTypeChange, onAuthChange, onTabChange, onSend, onSaved,
}: Props) {
  const tabs = ALL_TABS.filter((t) => !t.hideFor?.includes(method))
  const effectiveTab = tabs.some((t) => t.id === activeTab) ? activeTab : 'params'

  const urlValid = isValidUrl(url, envVariables)
  const showUrlError = url !== 'https://' && url !== 'http://' && url.trim() !== '' && !urlValid

  // Keep the colored overlay scrolled in sync with the input
  const urlInputRef = useRef<HTMLInputElement>(null)
  const urlOverlayRef = useRef<HTMLDivElement>(null)
  const [selStart, setSelStart] = useState<number | null>(null)
  const [selEnd, setSelEnd] = useState<number | null>(null)
  const [inputFocused, setInputFocused] = useState(false)

  function updateSelection(el: HTMLInputElement) {
    setSelStart(el.selectionStart)
    setSelEnd(el.selectionEnd)
  }

  function renderSegments(text: string, keyPrefix: string) {
    return text.split(/({{[\w]+}})/g).map((part, i) => {
      const isVar = /^{{[\w]+}}$/.test(part)
      if (!isVar) return <span key={`${keyPrefix}-${i}`} className="pointer-events-none text-text">{part}</span>
      const name = part.slice(2, -2)
      const resolved = name in envVariables
      const resolvedValue = resolved ? resolveVars(envVariables[name], envVariables) : undefined
      return (
        <Tooltip.Root key={`${keyPrefix}-${i}`} delayDuration={300}>
          <Tooltip.Trigger asChild>
            <span
              className={cn('pointer-events-auto cursor-text', resolved ? 'text-accent' : 'text-amber-400')}
              onMouseDown={(e) => { e.preventDefault(); urlInputRef.current?.focus() }}
            >
              {part}
            </span>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="top" sideOffset={6} className="px-2 py-1 rounded text-xs font-mono shadow-lg z-50 bg-elevated border border-border text-text">
              {resolved ? resolvedValue : 'Not set'}
              <Tooltip.Arrow className="fill-border" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      )
    })
  }

  useEffect(() => {
    const input = urlInputRef.current
    const overlay = urlOverlayRef.current
    if (!input || !overlay) return
    const sync = () => { overlay.scrollLeft = input.scrollLeft }
    input.addEventListener('scroll', sync)
    return () => input.removeEventListener('scroll', sync)
  }, [])

  // Sync after every URL change (browser may auto-scroll the input)
  useEffect(() => {
    if (urlInputRef.current && urlOverlayRef.current) {
      urlOverlayRef.current.scrollLeft = urlInputRef.current.scrollLeft
    }
  })

  // Global Cmd/Ctrl+Enter to send — document listener fires regardless of which element has focus
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && urlValid) {
        e.preventDefault()
        onSend()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onSend, urlValid])

  return (
    <div className="flex flex-col h-full">
      {/* Request name */}
      {activeRequest && (
        <div className="shrink-0 px-4 pt-3 pb-1">
          <h2 className="text-sm font-semibold text-text truncate">{activeRequest.name}</h2>
        </div>
      )}

      {/* URL bar */}
      <div className="shrink-0 border-b border-border">
      <div className="flex items-center p-3 gap-0">
        <MethodSelector value={method} onChange={onMethodChange} />

        {/* URL input with variable colouring overlay */}
        <div className="relative flex-1 h-9">
          <input
            ref={urlInputRef}
            value={url}
            onChange={(e) => { onUrlChange(e.target.value); updateSelection(e.target) }}
            onFocus={(e) => { setInputFocused(true); updateSelection(e.target) }}
            onBlur={() => { setInputFocused(false); setSelStart(null); setSelEnd(null) }}
            onSelect={(e) => updateSelection(e.currentTarget)}
            onKeyUp={(e) => updateSelection(e.currentTarget)}
            onClick={(e) => updateSelection(e.currentTarget)}
            onDoubleClick={(e) => { e.currentTarget.select(); updateSelection(e.currentTarget) }}
            placeholder="https://api.example.com/endpoint"
            spellCheck={false}
            style={{ caretColor: 'transparent' }}
            className={cn(
              'absolute inset-0 w-full h-full px-3 bg-transparent border border-l-0',
              'text-xs font-mono placeholder:text-subtle',
              'outline-none focus:ring-1 focus:ring-inset transition-colors',
              'text-transparent',
              showUrlError
                ? 'border-red-500 focus:ring-red-500'
                : 'border-border focus:ring-accent',
            )}
          />

          {/* Coloured overlay — after input in DOM so it sits on top */}
          <div
            ref={urlOverlayRef}
            aria-hidden="true"
            className={cn(
              'absolute inset-0 flex items-center px-3',
              'text-xs font-mono whitespace-nowrap overflow-hidden pointer-events-none',
              'border border-l-0 bg-elevated',
              showUrlError ? 'border-red-500' : 'border-border',
            )}
          >
            {url === '' ? null : (() => {
              const start = selStart ?? url.length
              const end = selEnd ?? url.length
              const hasSelection = inputFocused && start !== end
              if (hasSelection) {
                return (
                  <>
                    {renderSegments(url.slice(0, start), 'before')}
                    <span className="bg-accent/50 rounded-sm">{renderSegments(url.slice(start, end), 'sel')}</span>
                    {renderSegments(url.slice(end), 'after')}
                  </>
                )
              }
              return (
                <>
                  {renderSegments(url.slice(0, end), 'before')}
                  {inputFocused && selEnd !== null && (
                    <span
                      className="inline-block w-px shrink-0 self-center"
                      style={{ height: '0.875rem', backgroundColor: 'var(--color-text)', animation: 'blink 1s step-end infinite' }}
                    />
                  )}
                  {renderSegments(url.slice(end), 'after')}
                </>
              )
            })()}
          </div>
        </div>

        <button
          onClick={onSend}
          disabled={!urlValid}
          className={cn(
            'flex items-center gap-2 h-9 px-4 rounded-r',
            'text-xs font-semibold transition-colors',
            'focus:outline-none disabled:cursor-not-allowed',
            urlValid
              ? 'bg-accent text-white hover:bg-accent-dim'
              : 'bg-overlay text-subtle',
          )}
        >
          <Send size={13} />
          Send
        </button>

        <SaveRequestDialog
          method={method}
          url={url}
          params={params}
          headers={headers}
          body={body}
          bodyType={bodyType}
          auth={auth}
          activeRequest={activeRequest}
          isDirty={isDirty}
          onSaved={onSaved}
        />
      </div>
      {showUrlError && (
        <p className="px-3 pb-2 text-xs text-red-400">Enter a valid URL starting with http:// or https://</p>
      )}
      {hasVariables(url) && !showUrlError && (() => {
        const segments = parseSegments(url, envVariables)
        return (
          <p className="px-3 pb-2 text-xs font-mono truncate">
            {segments.map((seg, i) => (
              <span
                key={i}
                className={
                  seg.type === 'resolved'   ? 'text-accent' :
                  seg.type === 'unresolved' ? 'text-amber-400' :
                  'text-subtle'
                }
              >{seg.text}</span>
            ))}
          </p>
        )
      })()}
      </div>

      {/* Tabs */}
      <Tabs.Root
        value={effectiveTab}
        onValueChange={(v) => onTabChange(v as RequestTab)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <Tabs.List className="flex items-center border-b border-border px-3 shrink-0">
          {tabs.map((tab) => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              className={cn(
                'px-3 py-2.5 text-xs font-medium transition-colors relative select-none',
                'text-subtle hover:text-muted',
                'data-[state=active]:text-text',
                'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px',
                'after:bg-accent after:scale-x-0 data-[state=active]:after:scale-x-100',
                'after:transition-transform after:duration-150',
                'outline-none',
              )}
            >
              {tab.label}
              {tab.id === 'auth' && auth.type !== 'none' && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-accent align-middle -mt-px" />
              )}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="params" className="flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          <KeyValueEditor rows={params} onChange={onParamsChange} keyPlaceholder="Parameter" valuePlaceholder="Value" envVariables={envVariables} />
        </Tabs.Content>

        <Tabs.Content value="headers" className="flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          {(auth.type === 'basic' || (auth.type === 'inherit' && collectionAuth && collectionAuth.type !== 'none')) && (
            <div
              onClick={() => onTabChange('auth')}
              title="Managed by Auth tab — click to edit"
              className={cn(
                'grid grid-cols-[16px_1fr_1fr_28px] gap-2 px-3 py-1 items-center shrink-0',
                'border-b border-border/50 cursor-pointer select-none',
                'hover:bg-overlay/40 transition-colors',
                auth.type !== 'inherit' && !auth.enabled && 'opacity-40',
              )}
            >
              <Lock size={10} className="text-subtle" />
              <span className="text-xs font-mono text-subtle">Authorization</span>
              <span className="text-xs font-mono text-subtle truncate">
                {(() => {
                  const effective = auth.type === 'inherit' ? collectionAuth! : auth
                  return `Basic ${btoa(`${resolveVars(effective.username, envVariables)}:${resolveVars(effective.password, envVariables)}`)}`
                })()}
              </span>
              <span className="flex justify-end">
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded bg-overlay text-subtle">
                  {auth.type === 'inherit' ? 'Inherited' : 'Auth'}
                </span>
              </span>
            </div>
          )}
          <KeyValueEditor rows={headers} onChange={onHeadersChange} keyPlaceholder="Header" valuePlaceholder="Value" envVariables={envVariables} />
        </Tabs.Content>

        <Tabs.Content value="body" className="flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          <BodyEditor body={body} bodyType={bodyType} onBodyChange={onBodyChange} onBodyTypeChange={onBodyTypeChange} />
        </Tabs.Content>

        <Tabs.Content value="auth" className="flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          <AuthPanel
            auth={auth}
            onChange={onAuthChange}
            envVariables={envVariables}
            hasCollection={!!activeRequest?.collectionId}
            collectionAuth={collectionAuth}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
