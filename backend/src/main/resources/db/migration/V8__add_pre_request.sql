ALTER TABLE requests
    ADD COLUMN pre_request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    ADD COLUMN pre_request_success_codes JSONB NOT NULL DEFAULT '[200]';
