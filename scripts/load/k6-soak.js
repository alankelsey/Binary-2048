import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: Number(__ENV.SOAK_VUS || 40),
  duration: __ENV.SOAK_DURATION || '30m',
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<800']
  }
};

function postJson(path, payload) {
  return http.post(`${BASE}${path}`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export default function () {
  const create = postJson('/api/games', {});
  check(create, { 'create game 200': (r) => r.status === 200 });
  const id = create.status === 200 ? create.json()?.id : null;

  if (id) {
    const sequence = ['left', 'up', 'right', 'down'];
    for (const dir of sequence) {
      const move = postJson(`/api/games/${id}/move`, { dir });
      check(move, {
        'move under soak bounded': (r) => [200, 409, 429, 403].includes(r.status)
      });
    }

    if (Math.random() < 0.15) {
      const exportRes = http.get(`${BASE}/api/games/${id}/export`);
      check(exportRes, { 'export under soak': (r) => r.status === 200 });
    }
  }

  sleep(0.25);
}
