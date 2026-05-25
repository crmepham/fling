CREATE TABLE users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE collections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users (id),
    name        VARCHAR(255) NOT NULL,
    description VARCHAR(1000) NOT NULL DEFAULT '',
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES users (id),
    collection_id UUID REFERENCES collections (id) ON DELETE SET NULL,
    name          VARCHAR(255) NOT NULL,
    method        VARCHAR(10)  NOT NULL,
    url           VARCHAR(2048) NOT NULL,
    query_params  JSONB        NOT NULL DEFAULT '[]',
    headers       JSONB        NOT NULL DEFAULT '[]',
    body          TEXT,
    body_type     VARCHAR(20)  NOT NULL DEFAULT 'NONE',
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE environments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES users (id),
    name       VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE TABLE environment_variables (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID         NOT NULL REFERENCES environments (id) ON DELETE CASCADE,
    key            VARCHAR(255) NOT NULL,
    value          TEXT         NOT NULL,
    is_secret      BOOLEAN      NOT NULL DEFAULT FALSE,
    UNIQUE (environment_id, key)
);

CREATE TABLE history (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES users (id),
    request_id       UUID REFERENCES requests (id) ON DELETE SET NULL,
    method           VARCHAR(10) NOT NULL,
    url              TEXT        NOT NULL,
    query_params     JSONB       NOT NULL DEFAULT '{}',
    headers          JSONB       NOT NULL DEFAULT '{}',
    body             TEXT,
    response_status  INTEGER,
    response_headers JSONB       NOT NULL DEFAULT '{}',
    response_body    TEXT,
    duration_ms      INTEGER,
    sent_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_requests_user_id       ON requests (user_id);
CREATE INDEX idx_requests_collection_id ON requests (collection_id);
CREATE INDEX idx_history_user_id        ON history (user_id);
CREATE INDEX idx_history_request_id     ON history (request_id);
CREATE INDEX idx_history_sent_at        ON history (sent_at DESC);
