-- Optimization execution trace + parent/child performance comparison
ALTER TABLE bentley_optimization_runs
  ADD COLUMN execution_trace_json JSON NULL,
  ADD COLUMN comparison_json JSON NULL,
  ADD COLUMN improvement_score DECIMAL(12, 6) NULL,
  ADD COLUMN winning_variant TINYINT(1) NULL;
