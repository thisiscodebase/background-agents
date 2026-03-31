# Plan: Per-user OpenAI credentials with team API key fallback

- **Status:** Draft (not implemented)
- **Date:** 2026-03-31
- **Intent:** Optional per-user ChatGPT (OAuth) usage first; if absent, fall back to a shared team
  `OPENAI_API_KEY`.

This document defines **scope**, **requirements**, and **architecture changes** so the feature can
be estimated and sequenced later without ad-hoc discovery.

---

## 1. Goal

Allow an **individual** to link their **own ChatGPT / Codex OAuth identity** so OpenAI model calls
for sessions they start consume **their** subscription quota first. Users **without** a linked
account continue to use a **team-wide OpenAI API key** (existing platform-API path).

**Non-goals (initial scope):**

- Per-user **API keys** (users bringing `sk-...` as profile fields) — can be a follow-up; same
  storage/precedence patterns apply.
- Changing Anthropic/Claude credential model (already org/repo scoped elsewhere).
- Billing dashboards or usage attribution beyond what OAuth/API naturally provide.

---

## 2. Current behavior (baseline)

| Layer                | Behavior today                                                                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Secrets**          | `OPENAI_OAUTH_*` live in **global** and **repo** secrets; merged into sandbox `user_env_vars` with other keys.                                                                                           |
| **Refresh**          | Sandbox Codex plugin calls `POST /sessions/:id/openai-token-refresh`; `OpenAITokenRefreshService` reads **repo then global** secrets, refreshes, writes rotated tokens back to **repo or global** store. |
| **Session identity** | `SessionRow` includes `user_id` (and related fields); refresh runs in session DO context.                                                                                                                |
| **API key path**     | `OPENAI_API_KEY` in env → `auth.json` `type: "api"`; no Codex proxy; standard OpenAI API.                                                                                                                |
| **Precedence**       | If `OPENAI_OAUTH_REFRESH_TOKEN` is present in env, OAuth wins over `OPENAI_API_KEY` in sandbox bootstrap.                                                                                                |

**Gap:** There is **no** user-scoped secret store for OpenAI; OAuth is **shared per repo/instance**,
not per human.

**Security note:** Long-lived OAuth material may currently be included in merged secrets sent to the
sandbox. A hardened design should **minimize** refresh tokens in the container and drive OAuth
purely via control-plane refresh (see §4.3).

---

## 3. Requirements

### 3.1 Functional

1. **Link flow:** Authenticated user can start **Connect ChatGPT** (OAuth), complete provider
   consent, and have tokens stored **only under their identity**.
2. **Unlink / rotate:** User can disconnect or re-link (invalidate stored refresh token on unlink).
3. **Precedence (proposal):** For a session, resolve OpenAI auth in order:
   1. **User-linked** ChatGPT OAuth (if present and valid).
   2. **Repo** OAuth secrets (existing).
   3. **Global** OAuth secrets (existing).
   4. **`OPENAI_API_KEY`** (team / Modal / merged secrets) — platform API path.
   5. No credentials → clear error when user selects an OpenAI model.
4. **Sandbox behavior:** OpenAI Codex plugin continues to refresh via control plane; resolution of
   **which** refresh token to use must be **derived from session owner**, not from a single shared
   repo secret at refresh time.
5. **Backward compatibility:** Deployments with **only** repo/global OAuth or **only** team API key
   keep working without user linking.

### 3.2 Security & compliance

- Encrypt per-user tokens at rest (same class of protection as repo/global secrets).
- CSRF/state validation on OAuth callback; least-privilege scopes.
- Audit: optional log lines for “refresh used user vs team credential” (no raw tokens).
- **Avoid** shipping user refresh tokens to sandbox env where possible (see architecture).

### 3.3 UX

- Settings area: connection status, Connect / Disconnect, short explanation of precedence vs team
  key.
- Error surfaces: expired/revoked user OAuth → message to reconnect; optional fallback message when
  team key available.

### 3.4 Identity (open product question)

Sessions are keyed to a **user id** in the control plane. For **GitHub-only** web users, `user_id`
may map cleanly to one human. For **Slack / non-GitHub** flows (see ADR-003), the stable “human” key
may differ.

**Requirement to pin before build:** Define the **canonical credential owner id** (e.g. GitHub
numeric id, internal participant id, or both with explicit rules).

---

## 4. Architecture changes

### 4.1 Data model

- **New table** (or equivalent D1 construct): `user_openai_credentials` (name TBD), keyed by
  **credential owner id** (see §3.4).
- Columns (conceptual): encrypted payload or separate columns for refresh token, optional cached
  access token + expiry, `account_id`, `updated_at`, `user_id` FK or string id matching session user
  resolution.
- **Migration** in `terraform/d1/migrations/` + integration test cleanup patterns.

### 4.2 Control plane

1. **`OpenAITokenRefreshService`**
   - Extend `readTokenState(session)` to try **user store** first (using `session.user_id` or
     resolved owner id), then repo, then global.
   - On refresh success, write rotated tokens back to the **same scope** that supplied the refresh
     token (user vs repo vs global).

2. **`getUserEnvVars()` (session DO)**
   - **Strip** `OPENAI_OAUTH_*` from merged repo/global payload before sending to sandbox (so
     refresh tokens are not injected via env).
   - **Inject** explicit signals for sandbox bootstrap, e.g.:
     - `OPENAI_AUTH_MODE=oauth` when **any** OAuth path will serve this session (user, repo, or
       global), **or**
     - Encode in `SESSION_CONFIG` JSON (preferred if you want one structured contract).

3. **“Are OpenAI secrets configured?”**
   - `isOpenAISecretsConfigured()` should become true if **any** of: user-linked OAuth for this
     user, repo/global OAuth, or `OPENAI_API_KEY` available for fallback — exact gating per route.

4. **New HTTP routes (web-facing, authenticated)**
   - `GET` redirect to OpenAI OAuth authorize URL (PKCE/state).
   - `GET` callback: exchange code, persist to user store, redirect to settings.
   - `POST` disconnect: wipe user row.

5. **Auth client**
   - Reuse or extend `packages/control-plane/src/auth/openai.ts` for token exchange; ensure redirect
     URIs registered for production/staging.

### 4.3 Sandbox runtime (`packages/sandbox-runtime`)

- **`entrypoint` `_setup_openai_auth`**
  - Today: OAuth branch if `OPENAI_OAUTH_REFRESH_TOKEN` in env.
  - Target: OAuth branch if **`OPENAI_AUTH_MODE=oauth`** (or
    `SESSION_CONFIG.openaiAuth === "oauth"`) **without** requiring refresh token in env.
  - Still write the same stub `auth.json` (`managed-by-control-plane`) and deploy Codex plugin when
    in OAuth mode.

- **Codex plugin**
  - Unchanged contract: still calls session-scoped `openai-token-refresh`; control plane implements
    new resolution.

### 4.4 Web app (`packages/web`)

- Settings UI: Connect ChatGPT, status, disconnect.
- Optional: banner when session will use team API key vs personal (requires exposing non-secret
  “linked” boolean from API).

### 4.5 Terraform / Modal / CI

- **No change required** for team `OPENAI_API_KEY` beyond current optional `openai_api_key` /
  secrets — it remains the **fallback** injected into sandboxes.
- Ensure merged env still passes `OPENAI_API_KEY` when OAuth is **not** selected for that session,
  or always pass team key but let OpenCode ignore it when OAuth stub is active (verify OpenCode
  behavior; may need explicit “api key only when not oauth” env stripping).

### 4.6 Bots (Slack / GitHub / Linear)

- If sessions created by bots attribute to a **service** user id, policy must define whether
  bot-spawned sessions can use **team key only** or **requesting participant’s** linked OAuth. That
  is product-specific; document as **phase 2** or explicit rule in §3.4.

---

## 5. Credential resolution algorithm (reference)

When starting a sandbox or handling `openai-token-refresh`:

```
function resolveOpenAIAuth(session):
  ownerId = resolveCredentialOwner(session)  // define in §3.4

  if userStore.hasOAuth(ownerId):
    return OAuthSource.USER

  if repoSecrets.hasOAuth(session.repoId):
    return OAuthSource.REPO

  if globalSecrets.hasOAuth():
    return OAuthSource.GLOBAL

  if envHasOpenAIApiKey(session):  // merged + Modal llm secret
    return AuthSource.API_KEY

  return NONE
```

Sandbox env and `auth.json` setup follow `resolveOpenAIAuth` (OAuth stub + plugin vs API key file).

---

## 6. Phasing (suggested)

| Phase | Deliverable                                                                             |
| ----- | --------------------------------------------------------------------------------------- |
| **A** | D1 schema + `UserOpenAIStore` + encrypt/decrypt; no UI.                                 |
| **B** | OAuth connect/disconnect routes + minimal web settings.                                 |
| **C** | `OpenAITokenRefreshService` precedence + write-back to correct scope.                   |
| **D** | `getUserEnvVars` / `SESSION_CONFIG` contract + entrypoint OAuth without refresh in env. |
| **E** | Tests: unit + control-plane integration; manual E2E with real OAuth in staging.         |
| **F** | Docs: `OPENAI_MODELS.md`, operator runbook, precedence diagram.                         |

Phases C–D can be partially parallelized once the owner id and env contract are fixed.

---

## 7. Risks and open questions

1. **OpenAI OAuth policy** — Allowed redirect URIs, app review, rate limits; may mirror OpenCode’s
   flow or require first-party registration.
2. **Token rotation races** — Multiple concurrent refreshes for the same user; may need row-level
   versioning or compare-and-swap like existing repo/global paths.
3. **OpenCode semantics** — Confirm behavior when both stub OAuth and `OPENAI_API_KEY` exist in env;
   may need to unset API key in OAuth mode.
4. **Slack/non-GitHub users** — Who may link ChatGPT, and which `user_id` owns the credential row.
5. **Cost visibility** — Users may not see “you’re on team key now” without explicit UI.

---

## 8. Rough effort (order of magnitude)

- **Engineering:** ~1–3 weeks for a first production-ready slice (phases A–E), assuming OAuth
  registration is unblocked and identity rules are decided quickly.
- **Additional** for bot attribution rules, admin policies, and hard security review of env
  stripping: add **~3–7 days**.

---

## 9. Related code (starting points)

| Area              | Location                                                                            |
| ----------------- | ----------------------------------------------------------------------------------- |
| Token refresh     | `packages/control-plane/src/session/openai-token-refresh-service.ts`                |
| Sandbox env merge | `packages/control-plane/src/session/durable-object.ts` (`getUserEnvVars`)           |
| OAuth HTTP        | `packages/control-plane/src/auth/openai.ts`                                         |
| Sandbox auth file | `packages/sandbox-runtime/src/sandbox_runtime/entrypoint.py` (`_setup_openai_auth`) |
| Codex plugin      | `packages/sandbox-runtime/src/sandbox_runtime/plugins/codex-auth-plugin.ts`         |
| Session shape     | `packages/control-plane/src/session/types.ts` (`SessionRow`)                        |
| User-facing docs  | `docs/OPENAI_MODELS.md`                                                             |

---

## 10. Decision log (to fill when implemented)

- [ ] Credential owner id definition (GitHub vs internal participant).
- [ ] Bot-created sessions: team-only vs participant-linked OAuth.
- [ ] Whether repo/global OAuth secrets remain allowed once user linking exists (yes for backward
      compat, recommended).
