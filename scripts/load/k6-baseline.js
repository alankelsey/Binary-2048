import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 10,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<400']
  }
};

function json(url, body) {
  return http.post(url, JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export default function () {
  const create = json(`${BASE}/api/games`, {});
  check(create, {
    'create game status 200': (r) => r.status === 200
  });
  if (create.status !== 200) {
    sleep(1);
    return;
  }

  const game = create.json();
  const id = game?.id;
  if (!id) {
    sleep(1);
    return;
  }

  const dirs = ['left', 'up', 'right', 'down'];
  const dir = dirs[Math.floor(Math.random() * dirs.length)];
  const move = json(`${BASE}/api/games/${id}/move`, { dir });

  check(move, {
    'move status 200': (r) => r.status === 200
  });

  const health = http.get(`${BASE}/api/health`);
  check(health, {
    'health status 200': (r) => r.status === 200,
    'health ok true': (r) => String(r.body).includes('"ok":true')
  });

  sleep(0.5);
}
