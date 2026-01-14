import { sleep, check } from 'k6';
import { Options } from 'k6/options';
import http from 'k6/http';
import { loadEnv } from '../env-helper';
import exec from 'k6/execution';

export const options: Options = {
  scenarios: {
    mint: {
      executor: 'shared-iterations',
      vus: 100,
      iterations: 1000,
      exec: 'mint',
    },
  },
};

const env = loadEnv();

export function setup() {
  const token = env.VAULT_AUTH_TOKEN;

  if (!token) {
    throw new Error('VAULT_AUTH_TOKEN is not set in .env');
  }

  return { token };
}

export function mint(data: { token: string }) {
  const index = exec.scenario.iterationInTest + 1;
  const clientId = `client${index}`;

  const payload = JSON.stringify({
    assetId: 2184,
    clientId,
    amount: '1',
  });

  const headers = {
    'Content-Type': 'application/json',
    'X-ACCESS-TOKEN': data.token,
  };

  const res = http.post(
    'http://rox.localhost:4000/api/integration/tokenization/mint',
    payload,
    { headers }
  );

  console.log('Status Code:', res.status);

  const message = res.json('message') as string;
  if (message.toLocaleLowerCase().includes('transaction failed after multiple retries')) {
    console.error(`Deadlock error encountered for clientId ${clientId}: ${message}`);
  }

  check(res, {
    'mint status is 201': (r) => r.status === 201,
  });

  sleep(0.001);
}

export function teardown(data: { token: string }) {
  console.log(`Teardown with token: ${data.token}`);
}
