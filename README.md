# Fling

A simplistic, self-hostable, open-source alternative to Postman.

---

## Philosophy

Fling is designed to be the tool you actually want to run yourself. No accounts, no cloud sync, no telemetry — just a clean HTTP client you can spin up in a couple of commands and own completely. The goal is to cover the 90% of what developers use Postman for, without the bloat.

---

## Tech Stack

| Layer     | Technology          |
|-----------|---------------------|
| Frontend  | React               |
| Backend   | Spring Boot         |
| Database  | PostgreSQL          |
| Packaging | Docker Compose      |

---

## Core Features (v1)

- **Request Builder** — compose HTTP requests with full control over method, URL, query params, headers, and body
- **Collections** — organize requests into named groups
- **Environments** — define variable sets (e.g. `dev`, `staging`, `prod`) and switch between them; variables are interpolated into URLs, headers, and bodies using `{{variable_name}}` syntax
- **Response Viewer** — formatted display of response status, headers, and body (JSON, XML, plain text)
- **Request History** — every request sent is automatically saved with its full response, queryable and replayable

---

## Out of Scope (v1)

- Authentication / user login
- Multi-user workspaces
- Postman collection import/export
- Test scripting (pre/post request scripts)
- WebSocket or GraphQL support

---

## Architecture

```
┌─────────────────────────────────────┐
│           Browser (React)           │
│                                     │
│  Collections │ Request Builder      │
│  Environments │ History │ Response  │
└──────────────┬──────────────────────┘
               │ REST API (JSON)
┌──────────────▼──────────────────────┐
│         Spring Boot Backend         │
│                                     │
│  - Manages collections, requests,   │
│    environments, history            │
│  - Proxies outbound HTTP requests   │
│    on behalf of the browser         │
└──────────────┬──────────────────────┘
               │ JDBC
┌──────────────▼──────────────────────┐
│            PostgreSQL               │
└─────────────────────────────────────┘
```

The backend serves two roles:
1. A **CRUD API** for managing collections, requests, environments, and history
2. An **HTTP proxy** — the browser sends a "fire this request" payload to the backend, which executes it server-side and returns the result. This avoids CORS issues and keeps credentials out of the browser.

---

## Data Model

All entities are scoped to a `user_id`. In v1 there is a single default user. This design means adding real multi-user support later is additive (add auth, create more users) rather than a structural rewrite.

On first startup, the backend seeds the database with the default user and a collection named `"Default"`. At least one collection must always exist — deleting the last remaining collection is not permitted.

### Core Entities

**users**
- `id`, `created_at`

**collections**
- `id`, `user_id`, `name`, `description`, `created_at`, `updated_at`

**requests**
- `id`, `user_id`, `collection_id` (nullable — requests can exist outside a collection), `name`, `method`, `url`, `query_params` (JSONB), `headers` (JSONB), `body` (text), `body_type` (none / raw / form / form-data), `created_at`, `updated_at`

**environments**
- `id`, `user_id`, `name`, `created_at`, `updated_at`

**environment_variables**
- `id`, `environment_id`, `key`, `value`, `is_secret` (secrets are stored encrypted, never returned in plaintext to the frontend after being set)

**history**
- `id`, `user_id`, `request_id` (nullable — ad-hoc requests not tied to a saved request), `method`, `url`, `query_params` (JSONB), `headers` (JSONB), `body` (text), `response_status`, `response_headers` (JSONB), `response_body` (text), `duration_ms`, `sent_at`

---

## Variable Interpolation

Environments use `{{variable_name}}` syntax. Interpolation is applied by the backend at request execution time, not the frontend, so secrets never need to be sent to the browser after initial entry.

---

## Setup

**Requirements:** [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

```bash
git clone https://github.com/your-org/fling
cd fling
docker compose up -d
```

Then open `http://localhost` in your browser and log in with:

- **Username:** `admin`
- **Password:** `fling`

Your data is persisted in a Docker volume — it will survive container restarts.

---

## Configuration

Fling is configured via environment variables. Copy the provided example file to get started:

```bash
cp .env.example .env
```

Then edit `.env` to suit your setup. Docker Compose will pick it up automatically.

| Variable | Description | Default |
|---|---|---|
| `FLING_USERNAME` | Login username | `admin` |
| `FLING_PASSWORD` | Login password | `fling` |
| `BACKEND_PORT` | Port the backend listens on | `8080` |
| `FRONTEND_PORT` | Port the frontend is exposed on | `80` |

For example, to run the frontend on port 8081:

```
FRONTEND_PORT=8081
```

---

## Future Considerations

These are not planned but the architecture should not foreclose them:

- **Multi-user** — add an auth layer, associate all entities with real user accounts; the `user_id` FK is already in place
- **Teams / sharing** — shared collections scoped to a workspace rather than a user
- **Import/Export** — Fling-native JSON format for backup and migration
- **Request chaining** — use values from one response in a subsequent request
