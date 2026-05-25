import { create } from 'zustand'
import type { HttpMethod, KeyValue, ExecuteResponse } from '../types/api'

// A tab in the request panel
export type RequestTab = 'params' | 'headers' | 'body' | 'auth'
// A tab in the response panel
export type ResponseTab = 'body' | 'headers'

function makeRow(overrides: Partial<KeyValue> = {}): KeyValue {
  return { id: crypto.randomUUID(), key: '', value: '', enabled: true, ...overrides }
}

interface RequestStore {
  // ── Request being built ──────────────────────────────────────────────────
  method: HttpMethod
  url: string
  params: KeyValue[]
  headers: KeyValue[]
  body: string
  bodyType: 'NONE' | 'JSON' | 'FORM' | 'TEXT'
  activeRequestTab: RequestTab

  // ── Response from last execution ────────────────────────────────────────
  response: ExecuteResponse | null
  isExecuting: boolean
  activeResponseTab: ResponseTab

  // ── Environment ──────────────────────────────────────────────────────────
  selectedEnvironmentId: string | null

  // ── Actions ──────────────────────────────────────────────────────────────
  setMethod: (method: HttpMethod) => void
  setUrl: (url: string) => void
  setParams: (params: KeyValue[]) => void
  setHeaders: (headers: KeyValue[]) => void
  setBody: (body: string) => void
  setBodyType: (type: 'NONE' | 'JSON' | 'FORM' | 'TEXT') => void
  setActiveRequestTab: (tab: RequestTab) => void
  setResponse: (response: ExecuteResponse | null) => void
  setExecuting: (executing: boolean) => void
  setActiveResponseTab: (tab: ResponseTab) => void
  setEnvironmentId: (id: string | null) => void

  // Load a saved request into the editor
  loadRequest: (req: {
    method: HttpMethod
    url: string
    queryParams: Array<{ key: string; value: string; enabled: boolean }>
    headers: Array<{ key: string; value: string; enabled: boolean }>
    body?: string
    bodyType: 'NONE' | 'JSON' | 'FORM' | 'TEXT'
  }) => void
}

export const useRequestStore = create<RequestStore>((set) => ({
  method: 'GET',
  url: '',
  params: [makeRow()],
  headers: [makeRow()],
  body: '',
  bodyType: 'NONE',
  activeRequestTab: 'params',
  response: null,
  isExecuting: false,
  activeResponseTab: 'body',
  selectedEnvironmentId: null,

  setMethod: (method) => set({ method }),
  setUrl: (url) => set({ url }),
  setParams: (params) => set({ params }),
  setHeaders: (headers) => set({ headers }),
  setBody: (body) => set({ body }),
  setBodyType: (bodyType) => set({ bodyType }),
  setActiveRequestTab: (activeRequestTab) => set({ activeRequestTab }),
  setResponse: (response) => set({ response }),
  setExecuting: (isExecuting) => set({ isExecuting }),
  setActiveResponseTab: (activeResponseTab) => set({ activeResponseTab }),
  setEnvironmentId: (selectedEnvironmentId) => set({ selectedEnvironmentId }),

  loadRequest: (req) =>
    set({
      method: req.method,
      url: req.url,
      params: req.queryParams.length > 0
        ? req.queryParams.map((p) => ({ ...p, id: crypto.randomUUID() }))
        : [makeRow()],
      headers: req.headers.length > 0
        ? req.headers.map((h) => ({ ...h, id: crypto.randomUUID() }))
        : [makeRow()],
      body: req.body ?? '',
      bodyType: req.bodyType,
      response: null,
    }),
}))
