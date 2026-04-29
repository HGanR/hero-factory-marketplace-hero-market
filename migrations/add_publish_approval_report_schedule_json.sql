-- Part 23: nullable JSON schedule for automated publish-approval compliance report notifications.
ALTER TABLE campaigns
  ADD COLUMN publish_approval_report_schedule_json JSON NULL;
