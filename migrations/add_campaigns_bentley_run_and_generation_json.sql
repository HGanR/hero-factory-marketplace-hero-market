-- Bentley autonomous execution: persist generated campaign JSON keyed by orchestration run id.
ALTER TABLE campaigns
  ADD COLUMN bentley_run_id VARCHAR(128) NULL,
  ADD COLUMN bentley_generation_json JSON NULL;

CREATE UNIQUE INDEX campaigns_bentley_run_id_uidx ON campaigns (bentley_run_id);
