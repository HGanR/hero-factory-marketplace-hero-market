-- Agent avatar metadata on ai_agents for dashboard + creation flow
ALTER TABLE ai_agents
  ADD COLUMN avatarImageUrl TEXT NULL,
  ADD COLUMN avatarAltText VARCHAR(160) NULL;
