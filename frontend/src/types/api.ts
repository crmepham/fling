export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type AuthType = 'none' | 'basic' | 'bearer' | 'inherit'

export interface AuthConfig {
  type: AuthType
  enabled: boolean
  username: string
  password: string
  token?: string
}

export interface KeyValue {
  id: string
  key: string
  value: string
  enabled: boolean
}

export interface ExecuteRequest {
  requestId?: string
  environmentId?: string
  method: HttpMethod
  url: string
  queryParams: Array<{ key: string; value: string; enabled: boolean }>
  headers: Array<{ key: string; value: string; enabled: boolean }>
  body?: string
  bodyType: 'NONE' | 'JSON' | 'FORM' | 'TEXT'
}

export interface ExecuteResponse {
  historyId: string
  request: {
    method: string
    url: string
    queryParams: Record<string, string>
    headers: Record<string, string>
    body?: string
  }
  response: {
    status: number
    statusText: string
    headers: Record<string, string>
    body?: string
    durationMs: number
    bodySize: number
  }
}

export interface ResponseExtraction {
  source: 'body' | 'header'
  path: string
  variableKey: string
}

export interface SavedRequest {
  id: string
  collectionId?: string
  name: string
  method: HttpMethod
  url: string
  queryParams: Array<{ key: string; value: string; enabled: boolean }>
  headers: Array<{ key: string; value: string; enabled: boolean }>
  body?: string
  bodyType: 'NONE' | 'JSON' | 'FORM' | 'TEXT'
  auth?: AuthConfig | null
  responseExtractions?: ResponseExtraction[]
  createdAt: string
  updatedAt: string
  latestHistory?: {
    id: string
    method: string
    url: string
    queryParams: Record<string, string>
    headers: Record<string, string>
    body?: string | null
    responseStatus?: number | null
    responseHeaders: Record<string, string>
    responseBody?: string | null
    durationMs?: number | null
    sentAt: string
  } | null
}

export interface Collection {
  id: string
  name: string
  description?: string
  auth?: AuthConfig | null
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export interface CollectionWithRequests extends Collection {
  requests: SavedRequest[]
}

export interface EnvironmentSummary {
  id: string
  name: string
  variableCount: number
  createdAt: string
  updatedAt: string
}

export interface EnvironmentVariable {
  id: string
  key: string
  value: string | null  // null when isSecret is true
  isSecret: boolean
}

export interface EnvironmentDetail {
  id: string
  name: string
  variables: EnvironmentVariable[]
  createdAt: string
  updatedAt: string
}

export interface HistorySummary {
  id: string
  requestId?: string
  method: string
  url: string
  responseStatus?: number
  durationMs?: number
  sentAt: string
}

export interface HistoryDetail extends HistorySummary {
  queryParams: Record<string, string>
  headers: Record<string, string>
  body?: string
  responseHeaders: Record<string, string>
  responseBody?: string
}

export interface PageResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    totalElements: number
    totalPages: number
  }
}
