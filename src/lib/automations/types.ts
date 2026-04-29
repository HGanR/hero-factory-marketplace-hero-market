/** Trigger types supported by the automation engine */
export const TRIGGER_TYPES = [
  "contact_created",
  "call_completed",
  "offer_created",
  "pipeline_stage_changed",
  "tag_added",
  "form_submitted",
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];

/** Action/step types supported by the automation engine */
export const STEP_TYPES = [
  "send_email",
  "create_task",
  "update_field",
  "add_tag",
  "notify_consultant",
] as const;

export type StepType = (typeof STEP_TYPES)[number];

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  contact_created: "Contact created",
  call_completed: "Call completed",
  offer_created: "Offer created",
  pipeline_stage_changed: "Pipeline stage changed",
  tag_added: "Tag added",
  form_submitted: "Form submitted",
};

export const STEP_LABELS: Record<StepType, string> = {
  send_email: "Send email",
  create_task: "Create task",
  update_field: "Update field",
  add_tag: "Add tag",
  notify_consultant: "Notify consultant",
};
