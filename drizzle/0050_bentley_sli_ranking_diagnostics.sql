-- Bentley SLI: structured ranking diagnostics (transparency for opportunity ordering).

ALTER TABLE `lead_analyses`
  ADD COLUMN `rankingDiagnosticsJson` JSON NULL AFTER `topLeadDriversJson`;
