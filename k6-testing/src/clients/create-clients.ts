import { sleep, check } from 'k6';
import { Options } from 'k6/options';
import http from 'k6/http';
import { loadEnv } from '../env-helper';

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
  const res = http.get('http://rox.localhost:4000/');
  check(res, {
    'createClients status is 200': () => res.status === 200,
  });
  sleep(1);
};

export function teardown(data: { token: string }) {
  console.log(`Teardown with token: ${data.token}`);
}