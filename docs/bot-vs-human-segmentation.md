# Bot vs Human Segmentation Metrics

## Detection Signals

- Input cadence regularity
- Action entropy profile
- Session timing periodicity
- API-only interaction patterns

## Segment Outputs

- `human_likely`
- `bot_likely`
- `unknown`

## Usage

- Balance analysis by segment
- Abuse/rate-limit policy tuning
- Leaderboard fairness monitoring

## Safeguards

- Never auto-ban solely on one signal.
- Use multi-signal thresholds and review workflow.
