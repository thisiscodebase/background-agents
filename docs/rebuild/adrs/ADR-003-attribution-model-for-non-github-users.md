# ADR-003: Attribution model for users without GitHub accounts

- Status: Accepted
- Date: 2026-03-31
- Owners: rebuild project team

## Context

Most internal users will interact through Slack and do not have individual GitHub OAuth identities.
The system still needs clear human attribution for prompts, commits, and PR requests.

## Decision

1. Preserve per-prompt human identity from session participants (Slack/web user IDs).
2. For commit author metadata sent to sandbox runtime:
   - Use participant SCM name when available.
   - Fallback to participant user ID-derived identity and synthetic internal email.
3. For PR creation:
   - Continue using user OAuth auth when available.
   - Fallback to service/app auth when user OAuth is unavailable.
   - Always append attribution metadata in PR body:
     - requesting user id
     - auth mode (`user_oauth` or `service_fallback`)

## Alternatives Considered

- Require GitHub OAuth for all internal users:
  - Rejected due to adoption friction for non-technical teams.
- Always use service auth with no human metadata:
  - Rejected due to weak accountability and auditability.

## Consequences

- Positive:
  - Internal users can request/ship changes without GitHub accounts.
  - Human requester attribution remains visible in artifacts.
- Negative:
  - Service-auth PR mode may require policy guardrails in regulated workflows.

## Reversibility

- Can be tightened later to require GitHub OAuth for PR creation.
- Attribution metadata format can be evolved without schema migration.
