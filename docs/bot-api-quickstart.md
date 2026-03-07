# Bot API Quickstart

Minimal flow for external bot authors.

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
