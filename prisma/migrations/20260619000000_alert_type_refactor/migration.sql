-- AlertType refactor.
--
-- Before: AlertTable had `input` (source name string), `triggerType` (Webhook/Polling),
--         and `triggerParams` (JSON config with everything else).
-- After:  `input` stores the AlertType ('Polling' | 'Webhook' | 'Message Olvid'),
--         `alertParams` (renamed from triggerParams) carries the type-specific
--         config including the provider in `source`. `triggerType` is dropped.
--
-- The data migration moves the legacy `input` value into `alertParams.source`
-- and overwrites `input` with the matching AlertType. Polling rows keep their
-- existing triggerParams contents alongside the new `source` key.

-- 1. New column alongside the old one — Json nullable, same as triggerParams.
ALTER TABLE "AlertTable" ADD COLUMN "alertParams" JSONB;

-- 2. Polling rows: copy existing triggerParams + add `source = 'Polling Source'`,
--    then overwrite `input` with 'Polling'.
UPDATE "AlertTable"
SET    "alertParams" = COALESCE("triggerParams", '{}'::jsonb)
                       || jsonb_build_object('source', 'Polling Source'),
       "input"       = 'Polling'
WHERE  "input" = 'Polling Source';

-- 3. Webhook rows: build alertParams = { source: <old input> }, then
--    overwrite `input` with 'Webhook'. Everything that wasn't a polling
--    source is treated as a webhook.
UPDATE "AlertTable"
SET    "alertParams" = jsonb_build_object('source', "input"),
       "input"       = 'Webhook'
WHERE  "input" IS NOT NULL
  AND  "input" <> 'Polling';   -- skip the rows we just migrated above

-- 4. Drop the now-obsolete columns. triggerType was redundant once input
--    carries the AlertType; triggerParams has been superseded by alertParams.
ALTER TABLE "AlertTable" DROP COLUMN "triggerParams";
ALTER TABLE "AlertTable" DROP COLUMN "triggerType";
