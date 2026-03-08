# Event Taxonomy v1

Stable schema version: `binary2048-events-v1`.

## Core Event Groups

- Session: `session_start`, `session_resume`, `session_end`
- Move: `move_attempt`, `move_applied`, `move_noop`, `undo_used`
- Replay: `replay_export`, `replay_import`, `replay_play`, `replay_share`
- Social/Marketing: `share_click`, `referral_open`
- Store/Economy: `store_view`, `purchase_attempt`, `purchase_success`, `consume_boost`
- Auth: `auth_signin_open`, `auth_signin_success`, `auth_signout`
- Error: `ui_error`, `api_error`, `auth_config_error`

## Required Fields

- `event_name`
- `event_version`
- `event_time`
- `session_id`
- `user_tier` (`guest|authed|paid`)
- `mode`, `difficulty`
- `ruleset_id`, `engine_version`

## Privacy Rules

- No raw PII in event payload.
- Hash identifiers before export.
- Keep high-cardinality fields bounded.
