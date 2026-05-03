import http from 'k6/http';
import { sleep } from 'k6';
import { Trend } from 'k6/metrics';

const loginDuration = new Trend('login_duration');
const catalogDuration = new Trend('catalog_duration');

export const options = {
  stages: [
    { duration: '30s', target: 25 },
    { duration: '1m', target: 50 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = 'http://localhost:5000';

export default function () {
  const loginRes = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: 'nour.diab09@lau.edu', password: 'NewTestPass2026' }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } }
  );
  loginDuration.add(loginRes.timings.duration);

  sleep(1);

  const catalogRes = http.get(`${BASE}/api/programs`, { tags: { name: 'catalog' } });
  catalogDuration.add(catalogRes.timings.duration);
}
