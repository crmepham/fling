ALTER TABLE requests
    ADD COLUMN response_extractions JSONB NOT NULL DEFAULT '[]';
