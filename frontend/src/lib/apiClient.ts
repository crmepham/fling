import type { ExecuteRequest, ExecuteResponse, HistoryDetail, HistorySummary, PageResponse, Collection, SavedRequest, EnvironmentSummary, EnvironmentDetail, AuthConfig } from '../types/api'

const BASE = '/api/v1'

// Called whenever a request returns 401 — App.tsx wires this up to redirect to login
let onUnauthorized: (() => void) | null = null
export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (res.status === 401) {
    onUnauthorized?.()
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }
  return res.json() as Promise<T>
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  login: (username: string, password: string) =>
    request<{ username: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    request<void>('/auth/logout', { method: 'POST' }),

  me: () =>
    request<{ username: string }>('/auth/me'),

  // ── Execute ───────────────────────────────────────────────────────────────
  execute: (body: ExecuteRequest) =>
    request<ExecuteResponse>('/execute', { method: 'POST', body: JSON.stringify(body) }),

  // ── Collections ───────────────────────────────────────────────────────────
  listCollections: () =>
    request<PageResponse<Collection>>('/collections?page=1&pageSize=100'),

  listRequests: (collectionId: string) =>
    request<PageResponse<SavedRequest>>(`/collections/${collectionId}/requests?page=1&pageSize=100`),

  createCollection: (name: string, description?: string) =>
    request<Collection>('/collections', {
      method: 'POST',
      body: JSON.stringify({ name, description: description ?? '' }),
    }),

  deleteCollection: (id: string) =>
    request<void>(`/collections/${id}`, { method: 'DELETE' }),

  reorderCollections: (ids: string[]) =>
    request<void>('/collections/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) }),

  updateCollectionAuth: (id: string, auth: AuthConfig | null) =>
    request<Collection>(`/collections/${id}/auth`, { method: 'PATCH', body: JSON.stringify({ auth }) }),

  pinCollection: (id: string) =>
    request<Collection>(`/collections/${id}/pin`, { method: 'PATCH' }),

  // ── Requests ──────────────────────────────────────────────────────────────
  getRequest: (id: string) =>
    request<SavedRequest>(`/requests/${id}`),

  createRequest: (body: {
    collectionId: string
    name: string
    method: string
    url: string
    queryParams: Array<{ key: string; value: string; enabled: boolean }>
    headers: Array<{ key: string; value: string; enabled: boolean }>
    body?: string
    bodyType: string
    auth?: AuthConfig | null
  }) =>
    request<SavedRequest>('/requests', { method: 'POST', body: JSON.stringify(body) }),

  updateRequest: (id: string, body: {
    collectionId: string
    name: string
    method: string
    url: string
    queryParams: Array<{ key: string; value: string; enabled: boolean }>
    headers: Array<{ key: string; value: string; enabled: boolean }>
    body?: string
    bodyType: string
    auth?: AuthConfig | null
  }) =>
    request<SavedRequest>(`/requests/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  deleteRequest: (id: string) =>
    request<void>(`/requests/${id}`, { method: 'DELETE' }),

  reorderRequests: (collectionId: string, ids: string[]) =>
    request<void>(`/collections/${collectionId}/requests/reorder`, { method: 'PATCH', body: JSON.stringify({ ids }) }),

  moveRequest: (id: string, collectionId: string) =>
    request<SavedRequest>(`/requests/${id}/move`, { method: 'PATCH', body: JSON.stringify({ collectionId }) }),

  duplicateRequest: (id: string) =>
    request<SavedRequest>(`/requests/${id}/duplicate`, { method: 'POST' }),

  // ── Environments ──────────────────────────────────────────────────────────
  listEnvironments: () =>
    request<PageResponse<EnvironmentSummary>>('/environments?page=1&pageSize=100'),

  createEnvironment: (name: string) =>
    request<EnvironmentDetail>('/environments', { method: 'POST', body: JSON.stringify({ name }) }),

  getEnvironment: (id: string) =>
    request<EnvironmentDetail>(`/environments/${id}`),

  deleteEnvironment: (id: string) =>
    request<void>(`/environments/${id}`, { method: 'DELETE' }),

  bulkUpdateVariables: (id: string, variables: Array<{ id?: string; key: string; value: string; isSecret: boolean }>) =>
    request<EnvironmentDetail>(`/environments/${id}/variables`, { method: 'PUT', body: JSON.stringify({ variables }) }),

  // ── History ───────────────────────────────────────────────────────────────
  listHistory: (page = 1, pageSize = 50) =>
    request<PageResponse<HistorySummary>>(`/history?page=${page}&pageSize=${pageSize}`),

  getHistory: (id: string) =>
    request<HistoryDetail>(`/history/${id}`),

  getLatestHistory: (requestId: string) =>
    request<HistoryDetail | null>(`/history/latest?requestId=${requestId}`),

  clearHistory: () =>
    request<void>('/history', { method: 'DELETE' }),
}
