# Fling REST API Design

## Overview

Base path: `/api/v1`

All responses use `Content-Type: application/json`. All timestamps are ISO 8601 strings in UTC. Field names use camelCase throughout. In v1, all endpoints operate against the single implicit default user — no `Authorization` header is required.

On first startup, the backend seeds the database with a default user and a collection named `"Default"`. At least one collection must always exist — the last remaining collection cannot be deleted.

---

## Common Shapes

### Paginated Response Envelope

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalElements": 143,
    "totalPages": 8
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Collection with id 'abc123' does not exist.",
    "fieldErrors": []
  }
}
```

`fieldErrors` is an array of `{ "field": "name", "message": "must not be blank" }` objects, populated on 400 validation failures.

### Standard Error Codes

| HTTP Status | `code`                       |
|-------------|------------------------------|
| 400         | `VALIDATION_ERROR`           |
| 404         | `RESOURCE_NOT_FOUND`         |
| 409         | `CONFLICT`                   |
| 422         | `UNPROCESSABLE_ENTITY`       |
| 500         | `INTERNAL_ERROR`             |
| 502         | `PROXY_UPSTREAM_UNREACHABLE` |
| 504         | `PROXY_UPSTREAM_TIMEOUT`     |

---

## 1. Collections

### `GET /collections`

List all collections.

**Query Parameters**

| Name       | Type    | Default | Description                        |
|------------|---------|---------|------------------------------------|
| `page`     | integer | `1`     | 1-based page number                |
| `pageSize` | integer | `20`    | Items per page (max 100)           |

**Response `200 OK`**

```json
{
  "data": [
    {
      "id": "3f7a1b2c-e4d5-6789-abcd-ef0123456789",
      "name": "Payments API",
      "description": "All payment-related endpoints",
      "createdAt": "2026-01-15T10:30:00Z",
      "updatedAt": "2026-03-20T14:22:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalElements": 3,
    "totalPages": 1
  }
}
```

---

### `POST /collections`

Create a collection.

**Request Body**

```json
{
  "name": "Payments API",
  "description": "All payment-related endpoints"
}
```

| Field         | Required | Constraints                              |
|---------------|----------|------------------------------------------|
| `name`        | yes      | 1–255 characters                         |
| `description` | no       | max 1000 characters, defaults to `""`   |

**Response `201 Created`** — the created collection object.

---

### `GET /collections/{collectionId}`

Get a single collection.

**Response `200 OK`** — single collection object.

**Response `404 Not Found`**

---

### `PUT /collections/{collectionId}`

Full replacement update of a collection.

**Request Body** — same shape as `POST /collections`.

**Response `200 OK`** — updated collection object.

---

### `PATCH /collections/{collectionId}`

Partially update a collection. Only provided fields are changed.

**Response `200 OK`** — updated collection object.

---

### `DELETE /collections/{collectionId}`

Delete a collection. Requests inside the collection are **not** deleted — their `collectionId` is set to `null`, making them uncollected. Collections can be renamed freely, including the `"Default"` one.

**Response `204 No Content`**

**Response `404 Not Found`**

**Response `409 Conflict`** — if this is the last remaining collection. The user must always have at least one collection.

---

### `GET /collections/{collectionId}/requests`

List all requests belonging to a specific collection. Same pagination params and response shape as `GET /requests`.

---

## 2. Requests

### `GET /requests`

List all requests, optionally filtered.

**Query Parameters**

| Name           | Type    | Default | Description                                              |
|----------------|---------|---------|----------------------------------------------------------|
| `page`         | integer | `1`     | 1-based page number                                      |
| `pageSize`     | integer | `20`    | Items per page (max 100)                                 |
| `collectionId` | string  | —       | Filter to a specific collection                          |
| `uncollected`  | boolean | —       | If `true`, return only requests with no collection       |
| `method`       | string  | —       | Filter by HTTP method                                    |
| `search`       | string  | —       | Case-insensitive substring match on `name` and `url`     |

`collectionId` and `uncollected` are mutually exclusive; passing both returns `400`.

**Response `200 OK`**

```json
{
  "data": [
    {
      "id": "7c8d9e0f-1234-5678-abcd-ef0123456789",
      "collectionId": "3f7a1b2c-e4d5-6789-abcd-ef0123456789",
      "name": "Create Payment Intent",
      "method": "POST",
      "url": "https://api.stripe.com/v1/payment_intents",
      "queryParams": [
        { "key": "expand[]", "value": "latest_charge", "enabled": true }
      ],
      "headers": [
        { "key": "Content-Type", "value": "application/json", "enabled": true },
        { "key": "X-Debug", "value": "1", "enabled": false }
      ],
      "body": "{\"amount\": 1000, \"currency\": \"usd\"}",
      "bodyType": "raw",
      "createdAt": "2026-01-15T10:30:00Z",
      "updatedAt": "2026-03-20T14:22:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalElements": 47,
    "totalPages": 3
  }
}
```

**Notes on field shapes:**

- `queryParams` and `headers` are ordered arrays of key-value-enabled objects. The `enabled` flag lets users disable a param/header without deleting it.
- `collectionId` is `null` when the request is uncollected.
- `bodyType` is one of: `none`, `raw`, `form`, `form-data`.
- When `bodyType` is `form` or `form-data`, `body` holds a JSON-encoded array of `{ "key": string, "value": string, "enabled": boolean }` objects.
- When `bodyType` is `none`, `body` is `null`.

---

### `POST /requests`

Create a request.

**Request Body**

```json
{
  "collectionId": "3f7a1b2c-e4d5-6789-abcd-ef0123456789",
  "name": "Create Payment Intent",
  "method": "POST",
  "url": "https://api.stripe.com/v1/payment_intents",
  "queryParams": [
    { "key": "expand[]", "value": "latest_charge", "enabled": true }
  ],
  "headers": [
    { "key": "Authorization", "value": "Bearer {{stripe_key}}", "enabled": true }
  ],
  "body": "{\"amount\": 1000}",
  "bodyType": "raw"
}
```

| Field         | Required | Constraints                                                       |
|---------------|----------|-------------------------------------------------------------------|
| `collectionId`| no       | Must reference an existing collection if provided                 |
| `name`        | yes      | 1–255 characters                                                  |
| `method`      | yes      | One of: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`|
| `url`         | yes      | 1–2048 characters, may contain `{{variable}}` placeholders        |
| `queryParams` | no       | Array; defaults to `[]`                                           |
| `headers`     | no       | Array; defaults to `[]`                                           |
| `body`        | no       | Null or string                                                    |
| `bodyType`    | no       | One of: `none`, `raw`, `form`, `form-data`; defaults to `none`   |

**Response `201 Created`** — the created request object.

**Response `404 Not Found`** — if `collectionId` is provided but does not exist.

---

### `GET /requests/{requestId}`

Get a single request.

**Response `200 OK`** — single request object.

---

### `PUT /requests/{requestId}`

Full replacement update. All writable fields must be provided.

**Response `200 OK`** — updated request object.

---

### `PATCH /requests/{requestId}`

Partial update. Arrays (`queryParams`, `headers`) are replaced in their entirety when provided — no merge behavior on array contents.

**Response `200 OK`** — updated request object.

---

### `DELETE /requests/{requestId}`

Delete a request. Associated history entries retain their snapshot data but have their `requestId` set to `null`.

**Response `204 No Content`**

---

### `POST /requests/{requestId}/duplicate`

Duplicate a request. The copy gets the same `collectionId` and all fields copied, with name suffixed ` (Copy)`.

**Response `201 Created`** — the new request object.

---

### `PATCH /requests/{requestId}/move`

Move a request into or out of a collection.

**Request Body**

```json
{
  "collectionId": "3f7a1b2c-e4d5-6789-abcd-ef0123456789"
}
```

Pass `collectionId: null` to remove the request from its collection.

**Response `200 OK`** — updated request object.

---

## 3. Environments

### `GET /environments`

List all environments. Variable values are **not** included in the list response.

**Response `200 OK`**

```json
{
  "data": [
    {
      "id": "a1b2c3d4-5678-90ab-cdef-012345678901",
      "name": "Production",
      "variableCount": 8,
      "createdAt": "2026-01-10T08:00:00Z",
      "updatedAt": "2026-04-01T12:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

### `POST /environments`

Create an environment.

**Request Body**

```json
{
  "name": "Production"
}
```

| Field  | Required | Constraints                          |
|--------|----------|--------------------------------------|
| `name` | yes      | 1–255 characters, unique per user    |

**Response `201 Created`** — the created environment object.

**Response `409 Conflict`** — if an environment with that name already exists.

---

### `GET /environments/{environmentId}`

Get an environment including all its variables.

**Response `200 OK`**

```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-012345678901",
  "name": "Production",
  "variables": [
    {
      "id": "b2c3d4e5-6789-01ab-cdef-123456789012",
      "key": "BASE_URL",
      "value": "https://api.example.com",
      "isSecret": false
    },
    {
      "id": "b2c3d4e5-6789-01ab-cdef-123456789012",
      "key": "API_KEY",
      "value": null,
      "isSecret": true
    }
  ],
  "createdAt": "2026-01-10T08:00:00Z",
  "updatedAt": "2026-04-01T12:00:00Z"
}
```

Secret variables (`isSecret: true`) always have `value: null` in responses.

---

### `PUT /environments/{environmentId}`

Rename an environment.

**Request Body**

```json
{
  "name": "Production v2"
}
```

**Response `200 OK`** — updated environment object (with variables).

**Response `409 Conflict`** — if the new name conflicts with another environment.

---

### `DELETE /environments/{environmentId}`

Delete an environment and all its variables.

**Response `204 No Content`**

---

### `PUT /environments/{environmentId}/variables`

Bulk-replace all variables for an environment. The provided array becomes the complete authoritative set — existing variables not included are deleted.

**Request Body**

```json
{
  "variables": [
    { "key": "BASE_URL", "value": "https://api.example.com", "isSecret": false },
    { "key": "API_KEY", "value": "sk-live-abc123", "isSecret": true }
  ]
}
```

| Field                   | Required | Constraints                                    |
|-------------------------|----------|------------------------------------------------|
| `variables[].key`       | yes      | 1–255 characters, unique within the environment|
| `variables[].value`     | yes      | String (including empty string)                |
| `variables[].isSecret`  | no       | Boolean, defaults to `false`                   |

**Secret sentinel value:** If a variable's `key` matches an existing secret and `value` is the sentinel string `"__UNCHANGED__"`, the server preserves the stored secret without modification. This lets the frontend round-trip a masked representation without overwriting the real value.

**Response `200 OK`** — full environment object with new variable list; secrets masked.

**Response `400 Bad Request`** — if duplicate keys are present in the submitted array.

---

### `PATCH /environments/{environmentId}/variables/{variableId}`

Update a single variable.

**Request Body** — any subset of `key`, `value`, `isSecret`.

**Response `200 OK`**

```json
{
  "id": "b2c3d4e5-6789-01ab-cdef-123456789012",
  "key": "BASE_URL",
  "value": "https://api-v2.example.com",
  "isSecret": false
}
```

Secret variables return `value: null`.

---

### `DELETE /environments/{environmentId}/variables/{variableId}`

Delete a single variable.

**Response `204 No Content`**

---

## 4. Execute (Proxy)

### `POST /execute`

Send an HTTP request through the server-side proxy. The backend performs variable interpolation, executes the request, saves a history entry, and returns the result.

**Request Body**

```json
{
  "requestId": "7c8d9e0f-1234-5678-abcd-ef0123456789",
  "environmentId": "a1b2c3d4-5678-90ab-cdef-012345678901",
  "method": "POST",
  "url": "https://{{BASE_URL}}/payments",
  "queryParams": [
    { "key": "version", "value": "2", "enabled": true }
  ],
  "headers": [
    { "key": "Authorization", "value": "Bearer {{API_KEY}}", "enabled": true },
    { "key": "X-Debug", "value": "1", "enabled": false }
  ],
  "body": "{\"amount\": {{AMOUNT}}}",
  "bodyType": "raw"
}
```

| Field          | Required | Notes                                                                 |
|----------------|----------|-----------------------------------------------------------------------|
| `requestId`    | no       | If provided, the history entry is associated with this saved request  |
| `environmentId`| no       | If provided, variables from this environment are interpolated         |
| `method`       | yes      | Valid HTTP method                                                     |
| `url`          | yes      | After interpolation must be a valid absolute URL                      |
| `queryParams`  | no       | Only `enabled: true` entries are sent                                 |
| `headers`      | no       | Only `enabled: true` entries are sent                                 |
| `body`         | no       | Sent after interpolation when `bodyType` is not `none`               |
| `bodyType`     | yes      | One of `none`, `raw`, `form`, `form-data`                            |

**Interpolation rules:**
- `{{variableName}}` tokens in `url`, header values, query param values, and `body` are replaced with the matching environment variable value.
- Tokens with no matching variable are left as-is (not an error).
- Disabled params/headers are excluded from the outbound request entirely.

**Response `200 OK`**

```json
{
  "historyId": "c3d4e5f6-7890-12ab-cdef-234567890123",
  "request": {
    "method": "POST",
    "url": "https://api.example.com/payments",
    "queryParams": { "version": "2" },
    "headers": {
      "Authorization": "[REDACTED]",
      "Content-Type": "application/json"
    },
    "body": "{\"amount\": 500}"
  },
  "response": {
    "status": 201,
    "statusText": "Created",
    "headers": {
      "content-type": "application/json",
      "x-request-id": "req_xyz"
    },
    "body": "{\"id\": \"pay_abc\", \"status\": \"succeeded\"}",
    "durationMs": 312,
    "bodySize": 47
  }
}
```

**Notable behavior:**
- `request` reflects the interpolated outbound request as actually sent. Headers/body values that came from secret variables are shown as `[REDACTED]`.
- `historyId` is always present — a history entry is always created.
- `200` from `/execute` means Fling successfully proxied the call; the upstream status is inside `response.status`.
- Response body is returned as a string; the frontend handles pretty-printing.

**Response `400 Bad Request`** — URL is invalid or produces a malformed URL after interpolation.

**Response `502 Bad Gateway`** — upstream host unreachable.

**Response `504 Gateway Timeout`** — upstream exceeded the server timeout (default: 30s).

---

## 5. History

### `GET /history`

List execution history, newest first.

**Query Parameters**

| Name          | Type    | Default | Description                                              |
|---------------|---------|---------|----------------------------------------------------------|
| `page`        | integer | `1`     | 1-based page number                                      |
| `pageSize`    | integer | `50`    | Items per page (max 200)                                 |
| `requestId`   | string  | —       | Filter to history for a specific saved request           |
| `method`      | string  | —       | Filter by HTTP method                                    |
| `status`      | integer | —       | Filter by exact response status code                     |
| `statusRange` | string  | —       | Filter by status class: `2xx`, `3xx`, `4xx`, `5xx`      |
| `search`      | string  | —       | Case-insensitive substring match on `url`                |

`status` and `statusRange` are mutually exclusive; passing both returns `400`.

**Response `200 OK`** — list response omits full request/response bodies to keep payloads small:

```json
{
  "data": [
    {
      "id": "c3d4e5f6-7890-12ab-cdef-234567890123",
      "requestId": "7c8d9e0f-1234-5678-abcd-ef0123456789",
      "method": "POST",
      "url": "https://api.example.com/payments",
      "responseStatus": 201,
      "durationMs": 312,
      "sentAt": "2026-05-20T09:15:30Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalElements": 1204,
    "totalPages": 25
  }
}
```

---

### `GET /history/{historyId}`

Get full detail of a single history entry.

**Response `200 OK`**

```json
{
  "id": "c3d4e5f6-7890-12ab-cdef-234567890123",
  "requestId": "7c8d9e0f-1234-5678-abcd-ef0123456789",
  "method": "POST",
  "url": "https://api.example.com/payments",
  "queryParams": { "version": "2" },
  "headers": {
    "Authorization": "[REDACTED]",
    "Content-Type": "application/json"
  },
  "body": "{\"amount\": 500}",
  "responseStatus": 201,
  "responseHeaders": {
    "content-type": "application/json"
  },
  "responseBody": "{\"id\": \"pay_abc\", \"status\": \"succeeded\"}",
  "durationMs": 312,
  "sentAt": "2026-05-20T09:15:30Z"
}
```

`requestId` is `null` if the originating saved request has been deleted.

---

### `DELETE /history/{historyId}`

Delete a single history entry.

**Response `204 No Content`**

---

### `DELETE /history`

Clear history, optionally scoped.

**Query Parameters**

| Name        | Type   | Description                                                    |
|-------------|--------|----------------------------------------------------------------|
| `requestId` | string | If provided, clears only history for that saved request        |
| `before`    | string | ISO 8601 datetime; clears only entries with `sentAt` before this |

Parameters are combinable (AND semantics). Omitting both clears all history.

**Response `204 No Content`**

---

## Versioning

- Base path `/api/v1` is versioned. Breaking changes will increment the version.
- In v1, the single implicit default user is created on first startup. No `userId` appears in any request or response payload.
- When multi-user support is added, token-based auth replaces the implicit user without altering the resource path structure.
