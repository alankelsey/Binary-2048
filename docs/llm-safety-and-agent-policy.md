# Binary-2048 LLM Safety And Agent Policy

## Scope

This policy governs any LLM-assisted feature in Binary-2048, including:

- blog and content generation
- tile ideation workflows
- code-generation assistants
- dashboard summarization
- support drafting
- future chat or bot-personality systems

## Threat Model

The primary risk is prompt injection from untrusted content entering a model with access to tools, code, secrets, or publication workflows.

Untrusted sources include:

- player text
- issue reports
- social posts
- uploaded documents
- replay metadata
- admin-entered freeform text copied from external sources

## Trust Boundary Rule

Untrusted text must never directly control:

- deployment commands
- production configuration
- payout or entitlement decisions
- moderation actions without human review
- secret access
- database destructive actions

Models may summarize or classify untrusted inputs, but they must not execute authority-bearing actions based solely on that input.

## Sanitization Pipeline

Before untrusted text reaches any model:

- strip or neutralize markup where possible
- normalize URLs and attachments
- remove known prompt-wrapper patterns when feasible
- annotate provenance so operators know content is untrusted
- truncate oversized content

Sanitization reduces risk but does not create trust. All sanitized user content remains untrusted.

## Output Validation

Any LLM-generated output that can affect product behavior must pass validation before acceptance.

Minimum validation classes:

- schema validation
- replay compatibility checks
- unit/integration test execution
- lint/typecheck where code is involved
- policy review for monetization, ranked integrity, privacy, and abuse

For content workflows, validation must include:

- neutrality/style checks
- source verification where factual claims exist
- banned-topic checks if relevant to the channel

## Role Isolation

For multi-agent workflows, the same role must not propose, implement, and approve the same change.

Minimum separation:

- proposer agent
- implementer agent
- reviewer agent or human reviewer

Reviewer must be independent from the proposer. Human approval is required for production-affecting merges or config changes.

## Audit Logging

Log all LLM-originated changes with:

- task id
- initiating user or system
- prompt/input provenance class
- output artifact id
- validation results
- human approver identity if promoted
- final outcome

These logs should support rollback and incident review.

## Fallback Behavior

If prompt-injection, jailbreak, or tool-escalation signals are detected:

- do not execute tools
- do not publish
- do not mutate production state
- downgrade to safe summarization or reject
- log the event for review

Fail closed for high-risk actions.

## Secret-Handling Policy

Models should not receive secrets unless there is no lower-risk alternative.

Do not place these into model context unnecessarily:

- database URIs
- API keys
- admin tokens
- webhook secrets
- OAuth client secrets
- payout credentials

Preferred pattern:

- tools resolve secrets at execution time
- model receives capability descriptions, not raw secret values
- redaction is enforced in logs and prompts

## Product-Specific Rules For Binary-2048

For this product:

- LLMs may help draft neutral blog content and tile proposals
- LLMs may not approve prize logic, ranked scoring, or payout configuration
- LLM-generated gameplay changes must pass replay and determinism checks
- LLM-generated store or economy changes require manual review
- any player-facing emotional inference must follow the separate emotion policy

## Current Recommendation

Binary-2048 can safely use LLMs for low-authority drafting and ideation now, but all state-changing, payout-affecting, or production configuration actions must remain behind strict validation and human approval.
