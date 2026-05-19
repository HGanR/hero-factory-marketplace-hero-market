import "server-only";

/**
 * SKIPPER controlled learning — hard safety boundaries (no runtime enforcement via this export alone;
 * digest and compression modules must stay free of executors and package installs).
 */
export const SKIPPER_LEARNING_FORBIDDEN_AUTONOMY = [
  "rewrite_base_system_prompt",
  "train_foundation_weights",
  "install_packages",
  "create_or_modify_code",
  "publish_send_delete",
  "grant_self_permissions",
  "auto_enable_capabilities",
] as const;
