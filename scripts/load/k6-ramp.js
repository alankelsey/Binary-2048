import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '2m', target: 25 },
    { duration: '3m', target: 75 },
    { duration: '3m', target: 150 },
    { duration: '2m', target: 0 }
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<600']
  }
};

function postJson(path, payload) {
  return http.post(`${BASE}${path}`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export default function () {
  const create = postJson('/api/games', {});
  check(create, { 'create 200': (r) => r.status === 200 });
  const id = create.status === 200 ? create.json()?.id : null;

  if (id) {
    const dirs = ['left', 'up', 'right', 'down'];
    for (let i = 0; i < 3; i++) {
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      const move = postJson(`/api/games/${id}/move`, { dir });
      check(move, { 'move ok': (r) => r.status === 200 || r.status === 409 });
    }
  }

  if (Math.random() < 0.2) {
    const sim = postJson('/api/simulate', {
      seed: 111,
      moves: ['L', 'U', 'R', 'D'],
      config: { size: 4 }
    });
    check(sim, { 'simulate bounded': (r) => r.status === 200 || r.status === 429 || r.status === 403 });
  }

  sleep(0.2);
}
