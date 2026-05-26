import { useState, useEffect, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Tooltip from '@radix-ui/react-tooltip'
import { TopBar } from './components/layout/TopBar'
import { Sidebar } from './components/layout/Sidebar'
import { RequestPanel } from './components/request/RequestPanel'
import { RightPanel } from './components/request/RightPanel'
import { ResponsePanel } from './components/response/ResponsePanel'
import { LoginPage } from './components/auth/LoginPage'
import { ToastProvider } from './lib/toast'
import { api, setOnUnauthorized } from './lib/apiClient'
import { resolveVars } from './lib/variables'
import { useEnvironments, useEnvironmentDetail } from './hooks/useEnvironments'
import { useCollections } from './hooks/useCollections'
import type { HttpMethod, KeyValue, ExecuteResponse, SavedRequest, AuthConfig } from './types/api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<KeyValue> = {}): KeyValue {
  return { id: crypto.randomUUID(), key: '', value: '', enabled: true, ...overrides }
}

// Create the React Query client once outside the component so it isn't
// recreated on every render. It manages the cache for all useQuery/useMutation calls.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000 },
  },
})

// ─── Helpers for history loading ─────────────────────────────────────────────

const HTTP_STATUS_TEXT: Record<number, string> = {
  200: 'OK', 201: 'Created', 204: 'No Content',
  301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict',
  422: 'Unprocessable Entity', 429: 'Too Many Requests',
  500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
}

const draftKey = (id: string) => `fling:draft:${id}`

function saveDraft(id: string, state: object) {
  localStorage.setItem(draftKey(id), JSON.stringify(state))
}

function loadDraft(id: string) {
  try {
    const raw = localStorage.getItem(draftKey(id))
    return raw ? JSON.parse(raw) : null
  } catch {
    localStorage.removeItem(draftKey(id))
    return null
  }
}

function clearDraft(id: string) {
  localStorage.removeItem(draftKey(id))
}

// ─── New-request draft helpers ────────────────────────────────────────────────

export interface NewDraft {
  id: string
  method: string
  url: string
}

const NEW_DRAFTS_KEY = 'fling:new-drafts'
const newDraftDataKey = (id: string) => `fling:new-draft:${id}`

function loadNewDrafts(): NewDraft[] {
  try {
    const raw = localStorage.getItem(NEW_DRAFTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveNewDraftsList(drafts: NewDraft[]) {
  localStorage.setItem(NEW_DRAFTS_KEY, JSON.stringify(drafts))
}

function saveNewDraftData(id: string, state: object) {
  localStorage.setItem(newDraftDataKey(id), JSON.stringify(state))
}

function loadNewDraftData(id: string) {
  try {
    const raw = localStorage.getItem(newDraftDataKey(id))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function removeNewDraftData(id: string) {
  localStorage.removeItem(newDraftDataKey(id))
}

function guessBodyType(body?: string | null, headers?: Record<string, string>): 'NONE' | 'JSON' | 'FORM' | 'TEXT' {
  if (!body) return 'NONE'
  const ct = Object.entries(headers ?? {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? ''
  if (ct.includes('application/json')) return 'JSON'
  if (ct.includes('application/x-www-form-urlencoded')) return 'FORM'
  try { JSON.parse(body); return 'JSON' } catch {}
  return 'TEXT'
}

// ─── AppShell ─────────────────────────────────────────────────────────────────
// All request/response state lives here and is passed down as props.
// Once this grows unwieldy, it's a natural candidate for a Zustand store.

function AppShell({ onLogout }: { onLogout: () => void }) {
  // ── Request state ──────────────────────────────────────────────────────────
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [url, setUrl] = useState('https://')
  const [params, setParams] = useState<KeyValue[]>([makeRow()])
  const [headers, setHeaders] = useState<KeyValue[]>([makeRow()])
  const [body, setBody] = useState('')
  const [bodyType, setBodyType] = useState<'NONE' | 'JSON' | 'FORM' | 'TEXT'>('NONE')
  const [requestTab, setRequestTab] = useState<'params' | 'headers' | 'body' | 'auth'>('params')

  // ── Auth state ─────────────────────────────────────────────────────────────
  const defaultAuth: AuthConfig = { type: 'none', enabled: true, username: '', password: '' }
  const [auth, setAuth] = useState<AuthConfig>(defaultAuth)
  const [savedAuth, setSavedAuth] = useState<AuthConfig>(defaultAuth)

  // ── Active saved request (set when loaded from sidebar) ───────────────────
  const [activeRequest, setActiveRequest] = useState<SavedRequest | null>(null)

  // ── New-request drafts ─────────────────────────────────────────────────────
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const [newDrafts, setNewDrafts] = useState<NewDraft[]>(loadNewDrafts)

  // ── Response state ─────────────────────────────────────────────────────────
  const [response, setResponse] = useState<ExecuteResponse | null>(null)
  const [executeError, setExecuteError] = useState<string | null>(null)
  const [isExecuting, setExecuting] = useState(false)
  const [responseTab, setResponseTab] = useState<'body' | 'headers'>('body')
  const [sentAt, setSentAt] = useState<Date | null>(null)

  // ── Environment state ──────────────────────────────────────────────────────
  const [selectedEnv, setSelectedEnv] = useState('none')
  const { data: environments = [] } = useEnvironments()
  const { data: collections = [] } = useCollections()

  // ── Dirty check — true when current editor state differs from the active saved request ──
  const isDirty = useMemo(() => {
    if (!activeRequest) return false
    if (method !== activeRequest.method) return true
    if (url.split('?')[0] !== activeRequest.url) return true
    if (body !== (activeRequest.body ?? '')) return true
    if (bodyType !== activeRequest.bodyType) return true
    const activeParams = activeRequest.queryParams.filter((p) => p.key.trim() !== '')
    const currentParams = params.filter((p) => p.key.trim() !== '')
    if (activeParams.length !== currentParams.length) return true
    if (activeParams.some((p, i) => p.key !== currentParams[i]?.key || p.value !== currentParams[i]?.value || p.enabled !== currentParams[i]?.enabled)) return true
    const activeHeaders = activeRequest.headers.filter((h) => h.key.trim() !== '')
    const currentHeaders = headers.filter((h) => h.key.trim() !== '')
    if (activeHeaders.length !== currentHeaders.length) return true
    if (activeHeaders.some((h, i) => h.key !== currentHeaders[i]?.key || h.value !== currentHeaders[i]?.value || h.enabled !== currentHeaders[i]?.enabled)) return true
    if (auth.type !== savedAuth.type || auth.enabled !== savedAuth.enabled || auth.username !== savedAuth.username || auth.password !== savedAuth.password) return true
    return false
  }, [activeRequest, method, url, params, headers, body, bodyType, auth, savedAuth])

  // ── Persist draft to localStorage while dirty ─────────────────────────────
  useEffect(() => {
    if (!activeRequest || !isDirty) return
    const timer = setTimeout(() => {
      saveDraft(activeRequest.id, { method, url, params, headers, body, bodyType, auth })
    }, 500)
    return () => clearTimeout(timer)
  }, [activeRequest, isDirty, method, url, params, headers, body, bodyType, auth])

  // ── Auto-save new draft data + update sidebar label ───────────────────────
  useEffect(() => {
    if (!activeDraftId) return
    const timer = setTimeout(() => {
      saveNewDraftData(activeDraftId, { method, url, params, headers, body, bodyType, auth })
      setNewDrafts((prev) => {
        const updated = prev.map((d) => d.id === activeDraftId ? { ...d, method, url: url.split('?')[0] } : d)
        saveNewDraftsList(updated)
        return updated
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [activeDraftId, method, url, params, headers, body, bodyType, auth])

  // ── Collection auth for the active request ─────────────────────────────────
  const collectionAuth = useMemo(() => {
    if (!activeRequest?.collectionId) return null
    return collections.find((c) => c.id === activeRequest.collectionId)?.auth ?? null
  }, [activeRequest, collections])
  const { data: envDetail } = useEnvironmentDetail(selectedEnv === 'none' ? null : selectedEnv)
  const baseEnvVariables = useMemo<Record<string, string>>(
    () => Object.fromEntries(
      (envDetail?.variables ?? []).filter((v) => v.value !== null).map((v) => [v.key, v.value as string])
    ),
    [envDetail]
  )
  const [envOverrides, setEnvOverrides] = useState<Record<string, string>>({})
  const envVariables = useMemo(
    () => ({ ...baseEnvVariables, ...envOverrides }),
    [baseEnvVariables, envOverrides]
  )

  // Auto-select the first environment on initial load
  useEffect(() => {
    if (selectedEnv === 'none' && environments.length > 0) {
      setSelectedEnv(environments[0].id)
    }
  }, [environments, selectedEnv])

  // Clear overrides when environment changes or when server data updates (e.g. modal save)
  useEffect(() => {
    setEnvOverrides({})
  }, [selectedEnv, baseEnvVariables])

  // ── Create a new unsaved draft ─────────────────────────────────────────────
  function handleNewRequest() {
    const id = crypto.randomUUID()
    const initialState = { method: 'GET', url: 'https://', params: [makeRow()], headers: [makeRow()], body: '', bodyType: 'NONE' as const, auth: defaultAuth }
    const draft: NewDraft = { id, method: 'GET', url: 'https://' }
    const updated = [...newDrafts, draft]
    setNewDrafts(updated)
    saveNewDraftsList(updated)
    saveNewDraftData(id, initialState)

    setActiveDraftId(id)
    setActiveRequest(null)
    setMethod('GET')
    setUrl('https://')
    setParams([makeRow()])
    setHeaders([makeRow()])
    setBody('')
    setBodyType('NONE')
    setAuth(defaultAuth)
    setSavedAuth(defaultAuth)
    setRequestTab('params')
    setResponse(null)
    setExecuteError(null)
  }

  // ── Load an existing new-request draft ─────────────────────────────────────
  function handleDraftSelect(id: string) {
    const data = loadNewDraftData(id)
    setActiveDraftId(id)
    setActiveRequest(null)
    if (data) {
      setMethod(data.method)
      setUrl(data.url)
      setParams(data.params.map((p: KeyValue) => ({ ...p, id: crypto.randomUUID() })))
      setHeaders(data.headers.map((h: KeyValue) => ({ ...h, id: crypto.randomUUID() })))
      setBody(data.body)
      setBodyType(data.bodyType)
      setAuth(data.auth ?? defaultAuth)
      setSavedAuth(defaultAuth)
    } else {
      setMethod('GET')
      setUrl('https://')
      setParams([makeRow()])
      setHeaders([makeRow()])
      setBody('')
      setBodyType('NONE')
      setAuth(defaultAuth)
      setSavedAuth(defaultAuth)
    }
    setResponse(null)
    setExecuteError(null)
  }

  // ── Discard a new-request draft ────────────────────────────────────────────
  function handleDraftDiscard(id: string) {
    removeNewDraftData(id)
    const updated = newDrafts.filter((d) => d.id !== id)
    setNewDrafts(updated)
    saveNewDraftsList(updated)
    if (activeDraftId === id) {
      setActiveDraftId(null)
      setActiveRequest(null)
      setMethod('GET')
      setUrl('https://')
      setParams([makeRow()])
      setHeaders([makeRow()])
      setBody('')
      setBodyType('NONE')
      setAuth(defaultAuth)
      setSavedAuth(defaultAuth)
      setResponse(null)
      setExecuteError(null)
    }
  }

  // ── URL ↔ params two-way sync ──────────────────────────────────────────────
  function handleUrlChange(newUrl: string) {
    setUrl(newUrl)
    const qIdx = newUrl.indexOf('?')
    if (qIdx !== -1) {
      const qs = newUrl.slice(qIdx + 1)
      const parsed: KeyValue[] = qs
        .split('&')
        .filter(Boolean)
        .map((part) => {
          const eqIdx = part.indexOf('=')
          return {
            id: crypto.randomUUID(),
            key: eqIdx >= 0 ? part.slice(0, eqIdx) : part,
            value: eqIdx >= 0 ? part.slice(eqIdx + 1) : '',
            enabled: true,
          }
        })
      setParams(parsed.length > 0 ? parsed : [makeRow()])
    }
  }

  function handleParamsChange(newParams: KeyValue[]) {
    setParams(newParams)
    const base = url.split('?')[0]
    const active = newParams.filter((p) => p.enabled && p.key.trim() !== '')
    setUrl(
      active.length > 0
        ? `${base}?${active.map((p) => `${p.key}=${p.value}`).join('&')}`
        : base,
    )
  }

  // ── Method change — clear body when switching to a bodyless method ─────────
  function handleMethodChange(m: HttpMethod) {
    setMethod(m)
    if (m === 'GET' || m === 'DELETE') {
      setBody('')
      setBodyType('NONE')
    }
  }

  // ── Load saved request ─────────────────────────────────────────────────────
  function handleRequestSelect(req: SavedRequest) {
    setActiveDraftId(null)
    setActiveRequest(req)
    const storedAuth = req.auth ?? defaultAuth
    setSavedAuth(storedAuth)

    const draft = loadDraft(req.id)
    if (draft) {
      setMethod(draft.method)
      setUrl(draft.url)
      setParams(draft.params.map((p: KeyValue) => ({ ...p, id: crypto.randomUUID() })))
      setHeaders(draft.headers.map((h: KeyValue) => ({ ...h, id: crypto.randomUUID() })))
      setBody(draft.body)
      setBodyType(draft.bodyType)
      setAuth(draft.auth)
    } else {
      const bodyless = req.method === 'GET' || req.method === 'DELETE'
      setMethod(req.method)
      const baseUrl = (req.url || 'https://').split('?')[0]
      const loadedParams = req.queryParams.map((p) => ({ ...p, id: crypto.randomUUID() }))
      const activeParams = loadedParams.filter((p) => p.enabled && p.key.trim() !== '')
      setUrl(activeParams.length > 0 ? `${baseUrl}?${activeParams.map((p) => `${p.key}=${p.value}`).join('&')}` : baseUrl)
      setParams(loadedParams)
      setHeaders(req.headers.map((h) => ({ ...h, id: crypto.randomUUID() })))
      setBody(bodyless ? '' : (req.body ?? ''))
      setBodyType(bodyless ? 'NONE' : req.bodyType)
      setAuth(storedAuth)
    }
    setResponse(null)
    setExecuteError(null)

    const detail = req.latestHistory
    if (!detail || detail.responseStatus == null) return
    setResponse({
      historyId: detail.id,
      request: {
        method: detail.method,
        url: detail.url,
        queryParams: detail.queryParams ?? {},
        headers: detail.headers ?? {},
        body: detail.body,
      },
      response: {
        status: detail.responseStatus,
        statusText: HTTP_STATUS_TEXT[detail.responseStatus] ?? '',
        headers: detail.responseHeaders ?? {},
        body: detail.responseBody,
        durationMs: detail.durationMs ?? 0,
        bodySize: detail.responseBody?.length ?? 0,
      },
    })
    setResponseTab('body')
  }

  // ── Shared execute logic ───────────────────────────────────────────────────
  async function executeRequest(payload: object) {
    setExecuting(true)
    setExecuteError(null)
    setResponse(null)
    setSentAt(new Date())
    try {
      const res = await fetch('/api/v1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        let message = `Server error ${res.status}`
        try {
          const body = await res.json()
          if (body?.error?.message) message = body.error.message
        } catch { /* ignore, use default */ }
        throw new Error(message)
      }
      const data: ExecuteResponse = await res.json()
      setResponse(data)
      setResponseTab('body')
      queryClient.refetchQueries({ queryKey: ['history'] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    } catch (err) {
      setExecuteError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setExecuting(false)
    }
  }

  // ── Load and immediately send a saved request ─────────────────────────────
  function handleRequestSend(req: SavedRequest) {
    handleRequestSelect(req)
    const bodyless = req.method === 'GET' || req.method === 'DELETE'
    const activeHeaders = req.headers.filter((h) => h.key.trim() !== '')
    const authHeader = buildAuthHeader()
    const hasManualAuth = activeHeaders.some((h) => h.key.toLowerCase() === 'authorization')
    const mergedHeaders = authHeader && !hasManualAuth ? [authHeader, ...activeHeaders] : activeHeaders
    executeRequest({
      requestId: req.id,
      environmentId: selectedEnv === 'none' ? undefined : selectedEnv,
      method: req.method,
      url: req.url,
      queryParams: req.queryParams.filter((p) => p.key.trim() !== ''),
      headers: mergedHeaders,
      body: bodyless ? undefined : (req.body || undefined),
      bodyType: bodyless ? 'NONE' : req.bodyType,
    })
  }

  // ── Load a history item into the form + restore its response ─────────────
  async function handleHistorySelect(id: string) {
    try {
      const detail = await api.getHistory(id)
      const bodyless = detail.method === 'GET' || detail.method === 'DELETE'

      setActiveDraftId(null)
      setActiveRequest(null)
      setMethod(detail.method as HttpMethod)
      setUrl((detail.url || 'https://').split('?')[0])
      setParams(
        Object.entries(detail.queryParams ?? {}).map(([key, value]) => ({
          id: crypto.randomUUID(), key, value, enabled: true,
        }))
      )
      setHeaders(
        Object.entries(detail.headers ?? {}).map(([key, value]) => ({
          id: crypto.randomUUID(), key, value, enabled: true,
        }))
      )
      setBody(bodyless ? '' : (detail.body ?? ''))
      setBodyType(bodyless ? 'NONE' : guessBodyType(detail.body, detail.headers))
      setExecuteError(null)

      if (detail.responseStatus != null) {
        const httpStatus = HTTP_STATUS_TEXT[detail.responseStatus] ?? ''
        setResponse({
          historyId: detail.id,
          request: {
            method: detail.method,
            url: detail.url,
            queryParams: detail.queryParams ?? {},
            headers: detail.headers ?? {},
            body: detail.body,
          },
          response: {
            status: detail.responseStatus,
            statusText: httpStatus,
            headers: detail.responseHeaders ?? {},
            body: detail.responseBody,
            durationMs: detail.durationMs ?? 0,
            bodySize: detail.responseBody?.length ?? 0,
          },
        })
        setResponseTab('body')
      } else {
        setResponse(null)
      }
    } catch {
      // non-critical — form still usable
    }
  }

  // ── Send handler ───────────────────────────────────────────────────────────
  function buildAuthHeader(): { key: string; value: string; enabled: boolean } | null {
    const effective = auth.type === 'inherit' ? collectionAuth : auth
    if (!effective || effective.type !== 'basic' || !effective.enabled) return null
    const username = resolveVars(effective.username, envVariables)
    const password = resolveVars(effective.password, envVariables)
    return { key: 'Authorization', value: `Basic ${btoa(`${username}:${password}`)}`, enabled: true }
  }

  function handleSend() {
    if (!url.trim()) return
    const activeHeaders = headers.filter((h) => h.key.trim() !== '').map(({ key, value, enabled }) => ({ key, value, enabled }))
    const authHeader = buildAuthHeader()
    // Auth header is injected unless the user has manually set Authorization in the headers tab
    const hasManualAuth = activeHeaders.some((h) => h.key.toLowerCase() === 'authorization')
    const mergedHeaders = authHeader && !hasManualAuth ? [authHeader, ...activeHeaders] : activeHeaders
    executeRequest({
      requestId: activeRequest?.id,
      environmentId: selectedEnv === 'none' ? undefined : selectedEnv,
      method,
      url,
      queryParams: params
        .filter((p) => p.key.trim() !== '')
        .map(({ key, value, enabled }) => ({ key, value, enabled })),
      headers: mergedHeaders,
      body: body || undefined,
      bodyType,
    })
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-base">
      <TopBar selectedEnv={selectedEnv} onEnvChange={setSelectedEnv} onNewRequest={handleNewRequest} onLogout={onLogout} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeRequestId={activeRequest?.id}
          activeDraftId={activeDraftId}
          isDirty={isDirty}
          newDrafts={newDrafts}
          envVariables={envVariables}
          onRequestSelect={handleRequestSelect}
          onRequestSend={handleRequestSend}
          onHistorySelect={handleHistorySelect}
          onDraftSelect={handleDraftSelect}
          onDraftDiscard={handleDraftDiscard}
        />

        <main className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-hidden border-b border-border min-h-0">
            <div className="flex-1 min-w-0 overflow-hidden">
              <RequestPanel
                method={method}
                url={url}
                params={params}
                headers={headers}
                body={body}
                bodyType={bodyType}
                auth={auth}
                savedAuth={savedAuth}
                collectionAuth={collectionAuth}
                activeTab={requestTab}
                activeRequest={activeRequest}
                isDirty={isDirty}
                envVariables={envVariables}
                onMethodChange={handleMethodChange}
                onUrlChange={handleUrlChange}
                onParamsChange={handleParamsChange}
                onHeadersChange={setHeaders}
                onBodyChange={setBody}
                onBodyTypeChange={setBodyType}
                onAuthChange={setAuth}
                onTabChange={setRequestTab}
                onSend={handleSend}
                onSaved={(saved) => {
                  setActiveRequest(saved)
                  setSavedAuth(auth)
                  clearDraft(saved.id)
                  if (activeDraftId) {
                    removeNewDraftData(activeDraftId)
                    setNewDrafts((prev) => {
                      const updated = prev.filter((d) => d.id !== activeDraftId)
                      saveNewDraftsList(updated)
                      return updated
                    })
                    setActiveDraftId(null)
                  }
                }}
              />
            </div>
            <RightPanel
              method={method}
              selectedEnvId={selectedEnv}
              url={url}
              params={params}
              headers={headers}
              body={body}
              bodyType={bodyType}
              auth={auth}
              collectionAuth={collectionAuth}
              envVariables={envVariables}
              onVarChange={(name, value) =>
                setEnvOverrides((prev) => ({ ...prev, [name]: value }))
              }
            />
          </div>

          <div className="flex-1 overflow-hidden min-h-0">
            <ResponsePanel
              response={response}
              error={executeError}
              isExecuting={isExecuting}
              activeTab={responseTab}
              onTabChange={setResponseTab}
              sentAt={sentAt}
            />
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Auth gate ───────────────────────────────────────────────────────────────

function AuthGate() {
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    setOnUnauthorized(() => setIsAuthenticated(false))
    api.me()
      .then(() => setIsAuthenticated(true))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setAuthChecked(true))
  }, [])

  if (!authChecked) return null

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />
  }

  return <AppShell onLogout={() => setIsAuthenticated(false)} />
}

// ─── App ─────────────────────────────────────────────────────────────────────
// The default export wraps AuthGate in QueryClientProvider so that all
// useQuery/useMutation hooks work anywhere in the tree.

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Tooltip.Provider delayDuration={300}>
        <ToastProvider>
          <AuthGate />
        </ToastProvider>
      </Tooltip.Provider>
    </QueryClientProvider>
  )
}
