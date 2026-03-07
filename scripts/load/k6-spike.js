import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '20s', target: 300 },
    { duration: '1m', target: 300 },
    { duration: '40s', target: 20 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1200']
  }
};

function postJson(path, payload) {
  return http.post(`${BASE}${path}`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export default function () {
  if (Math.random() < 0.65) {
    const create = postJson('/api/games', {});
    if (create.status === 200) {
      const id = create.json()?.id;
      if (id) {
        const move = postJson(`/api/games/${id}/move`, { action: 'L' });
        check(move, { 'move accepted or guarded': (r) => [200, 409, 429, 403].includes(r.status) });
      }
    }
  } else {
    const heavy = postJson('/api/bots/tournament', {
      seedStart: 100,
      seedCount: 3,
      maxMoves: 64,
      bots: ['priority', 'random', 'alternate']
    });
    check(heavy, { 'heavy route bounded': (r) => [200, 429, 503, 403].includes(r.status) });
  }

  sleep(0.1);
}
