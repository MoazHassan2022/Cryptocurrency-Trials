import { sleep, check } from 'k6';
import { Options } from 'k6/options';
import http from 'k6/http';
import { loadEnv } from '../env-helper';
import exec from 'k6/execution';

// init stage file load
const imageBin = open('../src/nfts/image.png', 'b');

export const options: Options = {
  scenarios: {
    createNFT: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 1000,
      exec: 'createNFT',
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

export function createNFT(data: { token: string }) {
  const index = exec.scenario.iterationInTest + 1;
  const clientId = `client${index}`;

  const formData = {
    networkId: '29',
    name: 'NFT',
    symbol: 'NFT',
    ownerClientId: clientId,

    image: http.file(
      imageBin,
      'image.png',
      'image/png'
    ),
  };

  const headers = {
    'X-ACCESS-TOKEN': data.token,
  };

  const res = http.post(
    'http://rox.localhost:4000/api/integration/tokenization/nft',
    formData,
    { headers }
  );

  console.log('Response Body:', res.body);
  console.log('Status Code:', res.status);

  check(res, {
    'createNFT status is 201': (r) => r.status === 201,
  });

  sleep(0.001);
}

export function teardown(data: { token: string }) {
  console.log(`Teardown with token: ${data.token}`);
}
