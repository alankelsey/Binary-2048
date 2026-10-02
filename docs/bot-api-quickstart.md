# Bot API Quickstart

Minimal flow for external bot authors.

## Authentication and quotas

Hosted bot clients should request a server-issued API key and include it as
`x-api-key`. Each validated key receives its own endpoint quota. Missing or
invalid keys use the caller's IP quota.

Rate-limited responses publish:

- `RateLimit-Limit`: maximum requests in the current window.
- `RateLimit-Remaining`: requests left after the current request.
- `RateLimit-Reset`: window reset time as Unix epoch seconds.
- `RateLimit-Scope`: `api-key`, `account`, or `ip`, without exposing the identity.
- `RateLimit-Tier`: `guest`, `authed`, or `paid` when applicable.
- `Retry-After`: seconds to wait; included when the server returns `429`.

Clients must wait for `Retry-After` before retrying a `429` response.

## 1) Create game

```bash
curl -sS -X POST http://localhost:3000/api/games \
  -H "Content-Type: application/json" \
  -d '{}'
```

Save `id` from response.

## 2) Read encoded state

```bash
curl -sS "http://localhost:3000/api/games/<id>/encoded"
```

Key fields:

- `actionSpace`: `["L","R","U","D"]`
- `legalActions`
- `actionMask`
- `encodedFlat`

## 3) Submit move

```bash
curl -sS -X POST "http://localhost:3000/api/games/<id>/move" \
  -H "Content-Type: application/json" \
  -d '{"action":"L"}'
```

Validated bot API keys receive a dedicated quota of 600 gameplay moves per five
minutes, separate from the lower simulation, tournament, and training quotas.
Browser move limits are 600 for guests and authenticated accounts, and 1,800
for paid accounts. Clients must still honor the returned rate-limit
headers and `Retry-After` on `429`.

## Python starter

```python
import requests

BASE = "http://localhost:3000"

g = requests.post(f"{BASE}/api/games", json={}).json()
gid = g["id"]

while True:
    enc = requests.get(f"{BASE}/api/games/{gid}/encoded").json()
    legal = enc.get("legalActions", [])
    if not legal:
        break
    action = legal[0]
    moved = requests.post(f"{BASE}/api/games/{gid}/move", json={"action": action}).json()
    if moved.get("done"):
        break

print("final score:", moved.get("current", {}).get("score"))
```

## Queued research endpoints (V1)

Production tournament and training requests return HTTP `202` with `jobId`,
`statusUrl`, and `retryAfterSeconds`. Poll `GET /api/jobs/{jobId}` no faster than
once every two seconds, retaining the same `x-api-key`. Stop on `complete` and
read `result`, or on `failed` and report `error`. Results expire after 24 hours.
The opaque job URL is a read capability; do not publish it for private input.

The combined worker allowance is 250 admitted jobs per UTC month. Each job has
at most two 60-second, 2-GB execution attempts. Requests beyond the shared
allowance return `429` with `code: worker_budget_exhausted`; this is distinct
from a client's ordinary rate limit. Large research batches need a separate
budget decision. The included JavaScript bot tools and Python pipeline accept
both queued results and immediate local-development results.
