ALTER TABLE collections ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE requests    ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Seed sort_order from creation time so existing data has a stable order
UPDATE collections
SET sort_order = sub.rn
FROM (
    SELECT id, (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) - 1) AS rn
    FROM collections
) sub
WHERE collections.id = sub.id;

UPDATE requests
SET sort_order = sub.rn
FROM (
    SELECT id, (ROW_NUMBER() OVER (PARTITION BY collection_id ORDER BY created_at ASC) - 1) AS rn
    FROM requests
    WHERE collection_id IS NOT NULL
) sub
WHERE requests.id = sub.id;
