export interface Env {
  SANDBOX_API_SECRET: string;
  OPENINSPECT_BRIDGE_BOOT_CMD?: string;
  OPENINSPECT_BOOTSTRAP_CMD?: string;
  OPENINSPECT_GITHUB_TOKEN?: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateSandboxRequest {
  session_id?: string;
  sandbox_id?: string | null;
  repo_owner?: string;
  repo_name?: string;
  branch?: string | null;
  control_plane_url?: string;
  sandbox_auth_token?: string;
  repo_image_id?: string | null;
  provider?: string | null;
  model?: string | null;
  user_env_vars?: Record<string, string> | null;
  code_server_enabled?: boolean;
}

export interface RestoreSandboxRequest {
  snapshot_image_id?: string;
  sandbox_id?: string;
  session_config?: {
    session_id?: string;
    repo_owner?: string;
    repo_name?: string;
    branch?: string | null;
    provider?: string | null;
    model?: string | null;
  };
  control_plane_url?: string;
  sandbox_auth_token?: string;
  user_env_vars?: Record<string, string> | null;
}

export interface SnapshotSandboxRequest {
  sandbox_id?: string;
  session_id?: string;
  reason?: string;
}

export interface BuildRepoImageRequest {
  repo_owner?: string;
  repo_name?: string;
  default_branch?: string;
  build_id?: string;
  callback_url?: string;
  user_env_vars?: Record<string, string>;
}

export interface DeleteProviderImageRequest {
  provider_image_id?: string;
}
