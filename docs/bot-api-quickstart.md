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

Gameplay moves use a dedicated default quota of 600 requests per five minutes,
separate from the lower simulation, tournament, and training quotas. Clients
must still honor the returned rate-limit headers and `Retry-After` on `429`.

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
