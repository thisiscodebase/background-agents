# Using OpenAI Models

Open-Inspect supports OpenAI Codex models in addition to Anthropic Claude models. This guide covers
how to configure your deployment to use them.

> **Note**: This setup process is temporary and will be streamlined in a future release.

---

## Supported Models

| Model               | Description                                                                          |
| ------------------- | ------------------------------------------------------------------------------------ |
| GPT 5.2             | Fast baseline model (400K ctx)                                                       |
| GPT 5.4             | Flagship frontier model ([Codex models](https://developers.openai.com/codex/models)) |
| GPT 5.4 Mini        | Fast, efficient mini for responsive coding and subagents                             |
| GPT 5.2 Codex       | Optimized for code tasks                                                             |
| GPT 5.3 Codex       | Latest codex variant                                                                 |
| GPT 5.3 Codex Spark | Low-latency codex variant                                                            |

OpenAI models support reasoning effort levels: none, low, medium, high, and extra high (default:
high for Codex models).

---

## Authentication: OAuth vs API key

You can use **one** of these (not both at once for a given sandbox):

| Method             | Best for                                               | How credentials reach the sandbox                                                                |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **ChatGPT OAuth**  | ChatGPT Plus/Pro subscription (Codex via ChatGPT)      | Repository secrets (refresh token); control plane issues short-lived tokens                      |
| **OpenAI API key** | OpenAI Platform API billing (`sk-proj-...` / `sk-...`) | Global or repo secret `OPENAI_API_KEY`, and/or Terraform `openai_api_key` → Modal `llm-api-keys` |

**Precedence:** If `OPENAI_OAUTH_REFRESH_TOKEN` is set in the merged environment (from repo/global
secrets), OAuth is used and the ChatGPT/Codex proxy plugin is enabled. Otherwise, if
`OPENAI_API_KEY` is set, OpenCode uses the **standard OpenAI HTTP API** (no ChatGPT OAuth flow).

---

## Setup A: ChatGPT OAuth (subscription)

### Step 1: Obtain OpenAI OAuth Credentials

You'll use [OpenCode](https://opencode.ai) locally to authenticate with OpenAI and retrieve the
required tokens.

1. Install OpenCode if you haven't already
2. Launch OpenCode:
   ```bash
   opencode
   ```
3. Inside OpenCode, run `/connect setup`
4. Select **ChatGPT** and complete the OAuth login flow in your browser
5. After authenticating, open the credentials file:
   ```bash
   cat ~/.local/share/opencode/auth.json
   ```
6. From the `openai` section, copy the values for:
   - `refresh` — the refresh token
   - `accountId` — your ChatGPT account ID

### Step 2: Add Secrets to Your Deployment

1. Go to your Open-Inspect web app's **Settings** page
2. Add the following repository secrets:

   | Secret Name                  | Value                           |
   | ---------------------------- | ------------------------------- |
   | `OPENAI_OAUTH_REFRESH_TOKEN` | The `refresh` token from Step 1 |
   | `OPENAI_OAUTH_ACCOUNT_ID`    | The `accountId` from Step 1     |

### Step 3: Select an OpenAI Model

When creating a new session, choose any OpenAI model from the model dropdown. Sessions using OpenAI
models will automatically use your configured credentials.

---

## Setup B: OpenAI API key (platform API)

Use this when you have an API key from [OpenAI Platform](https://platform.openai.com/) and want
billing on your developer account instead of ChatGPT OAuth.

1. **Repository or global secrets (recommended for per-repo keys)**  
   In **Settings → Secrets**, add:

   | Secret Name      | Value             |
   | ---------------- | ----------------- |
   | `OPENAI_API_KEY` | Your `sk-...` key |

   Repo secrets override global secrets for the same key (same rules as other env secrets).

2. **Terraform / Modal (optional, like `anthropic_api_key`)**  
   Set `openai_api_key` in `terraform.tfvars` (or `TF_VAR_openai_api_key` / GitHub secret
   `OPENAI_API_KEY` in CI). Terraform merges it into the Modal secret `llm-api-keys`, so every
   sandbox receives `OPENAI_API_KEY` in its environment.

3. **Local Modal testing**  
   Add the key to the `llm-api-keys` secret:

   ```bash
   modal secret create llm-api-keys ANTHROPIC_API_KEY="..." OPENAI_API_KEY="sk-..." --force
   ```

Do **not** set `OPENAI_OAUTH_REFRESH_TOKEN` if you intend to use API-key mode only; if both are
present, OAuth takes precedence.

---

## How It Works

### OAuth mode

Your refresh token is stored securely in the control plane and is never exposed to sandboxes. When a
sandbox needs to make an OpenAI API call, it requests a short-lived access token from the control
plane, which handles token refresh and rotation automatically. Only the temporary access token is
present inside the sandbox.

Credentials are scoped per repository, so different repos can use different OpenAI accounts.

### API key mode

The supervisor writes OpenCode’s `auth.json` with `"type": "api"` and your key. OpenCode talks to
the standard OpenAI API. The Codex OAuth proxy plugin is **not** loaded, so requests are not routed
through `chatgpt.com` backend endpoints.

---

## Troubleshooting

### Model doesn't appear in the dropdown

Ensure your deployment is up to date. OpenAI model support requires the latest version of
Open-Inspect.

### Session fails to start with an OpenAI model (OAuth)

Verify that both `OPENAI_OAUTH_REFRESH_TOKEN` and `OPENAI_OAUTH_ACCOUNT_ID` are set in your
repository secrets (Settings page). The refresh token may have expired — repeat OAuth Step 1 to
obtain fresh credentials.

### Session fails with an API key

- Confirm `OPENAI_API_KEY` is set (repo/global secret and/or Modal `llm-api-keys`) and that
  `OPENAI_OAUTH_REFRESH_TOKEN` is **unset** if you want API-key mode.
- Ensure the key has access to the models you selected on the OpenAI Platform.

### "Token refresh failed" errors (OAuth)

The OAuth refresh token may have been revoked or expired. Re-authenticate using Setup A and update
the secrets in your Settings page.
