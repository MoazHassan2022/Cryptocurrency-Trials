import { sleep, check } from 'k6';
import { Options } from 'k6/options';
import http from 'k6/http';
import { loadEnv } from '../env-helper';
import exec from 'k6/execution';

export const options: Options = {
  scenarios: {
    createClients: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 100,
      // duration: '10s',
      exec: 'createClients',
    },
  }
};

const env = loadEnv();

export function setup() {
  const token = env.VAULT_AUTH_TOKEN;

  console.log(`Using VAULT_AUTH_TOKEN: ${token}`);

  if (!token) {
    throw new Error('VAULT_AUTH_TOKEN is not set in .env');
  }

  return {
    token,
  };
}

export function createClients(data: { token: string }) {
  const index = exec.scenario.iterationInTest + 901;

  const payload = JSON.stringify({
    id: `client${index}`,
  });

  const headers = {
    'Content-Type': 'application/json',
    'X-ACCESS-TOKEN': data.token,
  };

  const res = http.post(
    'http://rox.localhost:4000/api/integration/clients/create',
    payload,
    { headers }
  );

  check(res, {
    'createClients status is 201': (r) => r.status === 201,
  });

  sleep(0.001);
}

export function teardown(data: { token: string }) {
  console.log(`Teardown with token: ${data.token}`);
}