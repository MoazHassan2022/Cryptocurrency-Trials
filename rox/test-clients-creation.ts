import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";

// === CONFIG ===
const API_URL = "http://rox.localhost:4000/api/integration/clients/create";
const WALLET_URL_BASE =
  "http://rox.localhost:4000/api/integration/wallets/client-wallet-by-network";

const API_KEY = "0075f018f5874ae2";
const NETWORK_ID = 29;

const TOTAL_CLIENTS = 300_000;
const WALLET_CONCURRENCY = 10000;   // batch size for both create + wallet polling
const DELAY_MS = 3000;            // delay BETWEEN CREATE iterations only

const RATE_LIMIT_DELAY_MS = 5000;
const START_FROM = 0;

// Wallet timing / polling
const WALLET_INITIAL_DELAY_MS = 20000; // one-time delay BEFORE polling phase
const WALLET_POLL_INTERVAL_MS = 10000;
const WALLET_MAX_ATTEMPTS = 100;

// === SETUP ===
const failedDir = path.join(process.cwd(), "failed_requests");
const failedWalletDir = path.join(process.cwd(), "failed_wallet_requests");

// === TYPES ===
type CreatedClient = {
  externalId: string;
  internalId: number;
};

// === UTILITY ===
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function writeFail(dir: string, file: string, payload: any) {
  const failPath = path.join(dir, file);
  await fs.writeFile(failPath, JSON.stringify(payload, null, 2));
}

// Simple concurrency pool
async function asyncPool<T>(
  poolLimit: number,
  items: T[],
  iteratorFn: (item: T) => Promise<any>
) {
  const ret: Promise<any>[] = [];
  const executing: Promise<any>[] = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    if (poolLimit <= items.length) {
      const e: Promise<any> = p.then(() => {
        executing.splice(executing.indexOf(e), 1);
      });
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(ret);
}

// === CREATE CLIENT ===
async function sendCreateClient(externalId: string): Promise<CreatedClient | null> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": API_KEY,
      },
      body: JSON.stringify({ id: externalId }),
    });

    const data: any = await res.json().catch(() => ({}));

    if (res.status === 429) throw new Error("RATE_LIMITED");

    if (!res.ok) {
      if (res.status !== 422 && res.status !== 429) {
        await writeFail(failedDir, `${externalId}.json`, {
          request: { id: externalId },
          error: `Response not ok: ${res.status}`,
          body: data,
          timestamp: new Date().toISOString(),
        });
      }
      throw new Error(`Response not ok: ${res.status}`);
    }

    if (data.client?.external_id !== externalId) {
      throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
    }

    const internalId = data.client?.id;
    if (typeof internalId !== "number") {
      throw new Error(`Missing internal client id in response: ${JSON.stringify(data)}`);
    }

    console.log(`✅ [${externalId}] Client created (internalId=${internalId})`);
    return { externalId, internalId };
  } catch (err: any) {
    if (err.message === "RATE_LIMITED") throw err;
    console.error(`❌ [${externalId}] Create failed: ${err.message}`);
    return null;
  }
}

// === GET CLIENT WALLET (one try) ===
async function fetchWalletOnce(internalClientId: number) {
  const url = `${WALLET_URL_BASE}/${NETWORK_ID}/${internalClientId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": API_KEY,
    },
  });

  const data: any = await res.json().catch(() => ({}));

  if (res.status === 429) throw new Error("RATE_LIMITED");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Wallet response not ok: ${res.status}`);

  if (!data?.data?.id) {
    throw new Error(`Unexpected wallet response: ${JSON.stringify(data)}`);
  }

  return data;
}

// === WAIT/POLL FOR WALLET ===
async function waitForWallet(client: CreatedClient) {
  const { externalId, internalId } = client;

  try {
    for (let attempt = 1; attempt <= WALLET_MAX_ATTEMPTS; attempt++) {
      try {
        const walletData = await fetchWalletOnce(internalId);

        if (walletData) {
          console.log(
            `💳 [${externalId} -> ${internalId}] Wallet ready (walletId=${walletData.data.id})`
          );
          return true;
        }

        console.log(
          `⏳ [${externalId} -> ${internalId}] Wallet not ready (attempt ${attempt}/${WALLET_MAX_ATTEMPTS})`
        );

        await sleep(WALLET_POLL_INTERVAL_MS);
      } catch (err: any) {
        if (err.message === "RATE_LIMITED") throw err;

        await writeFail(failedWalletDir, `${externalId}.json`, {
          request: { networkId: NETWORK_ID, internalClientId: internalId, externalId },
          error: err.message,
          timestamp: new Date().toISOString(),
        });

        console.error(`❌ [${externalId} -> ${internalId}] Wallet check failed: ${err.message}`);
        return false;
      }
    }

    await writeFail(failedWalletDir, `${externalId}.json`, {
      request: { networkId: NETWORK_ID, internalClientId: internalId, externalId },
      error: "Wallet not created after max attempts",
      timestamp: new Date().toISOString(),
    });

    console.warn(`🟠 [${externalId} -> ${internalId}] Wallet not created after retries`);
    return false;
  } catch (err: any) {
    if (err.message === "RATE_LIMITED") throw err;
    console.error(`❌ [${externalId} -> ${internalId}] Wallet polling unexpected error: ${err.message}`);
    return false;
  }
}

// === MAIN ===
async function main() {
  const overallStart = Date.now(); // ✅ start timing from FIRST create
  console.time("Load test (wall-clock)");

  await fs.mkdir(failedDir, { recursive: true });
  await fs.mkdir(failedWalletDir, { recursive: true });

  const totalCreateIterations = Math.ceil(TOTAL_CLIENTS / WALLET_CONCURRENCY);

  const startFrom = Math.min(TOTAL_CLIENTS, Math.max(1, START_FROM));
  const startCreateIteration = Math.floor((startFrom - 1) / WALLET_CONCURRENCY);

  // ✅ Global counters + ordered created list
  let totalCreatedSuccess = 0;
  let totalWalletSuccess = 0;
  let totalBothSuccess = 0;

  const allCreatedClients: CreatedClient[] = [];

  // ==========================
  // PHASE 1: CREATE ALL CLIENTS
  // ==========================
  for (let i = startCreateIteration; i < totalCreateIterations; i++) {
    let startId = i * WALLET_CONCURRENCY + 1;
    let endId = Math.min(startId + WALLET_CONCURRENCY - 1, TOTAL_CLIENTS);

    if (i === startCreateIteration) {
      startId = startFrom;
    }

    const batchExternalIds = Array.from(
      { length: endId - startId + 1 },
      (_, j) => `${startId + j}`
    );

    console.log(
      `\n🚀 CREATE Iteration ${i + 1}/${totalCreateIterations} (clients ${startId}-${endId})`
    );

    let iterationDone = false;
    while (!iterationDone) {
      try {
        const createdClientsRaw = await Promise.all(
          batchExternalIds.map(sendCreateClient)
        );

        const createdClients: CreatedClient[] = createdClientsRaw.filter(
          (c): c is CreatedClient => c !== null
        );

        const iterationCreatedSuccess = createdClients.length;

        // ✅ commit to global list ONCE per successful iteration
        allCreatedClients.push(...createdClients);
        totalCreatedSuccess += iterationCreatedSuccess;

        console.log(
          `✅ CREATE Iteration ${i + 1} done: created=${iterationCreatedSuccess}`
        );

        iterationDone = true;
      } catch (err: any) {
        if (err.message === "RATE_LIMITED") {
          console.warn(
            `⚠️ Rate limit during CREATE. Waiting ${RATE_LIMIT_DELAY_MS / 1000}s then retrying CREATE iteration ${i + 1}...`
          );
          await sleep(RATE_LIMIT_DELAY_MS);
          continue;
        }

        console.error(
          `❌ Unexpected error in CREATE iteration ${i + 1}: ${err.message}`
        );
        iterationDone = true;
      }
    }

    // ✅ delay only between CREATE iterations
    console.log(`🌀 CREATE Iteration ${i + 1} finished (${endId}/${TOTAL_CLIENTS})`);
    await sleep(DELAY_MS);
  }

  // ==========================
  // PHASE 2: POLL WALLETS IN ORDER
  // ==========================
  // console.log(
  //   `\n🟦 All create iterations finished. Total created clients to poll: ${allCreatedClients.length}`
  // );

  // console.log(
  //   `⌛ Waiting ${WALLET_INITIAL_DELAY_MS / 1000}s before starting wallet polling phase...`
  // );
  // await sleep(WALLET_INITIAL_DELAY_MS);

  // const totalWalletIterations = Math.ceil(allCreatedClients.length / WALLET_CONCURRENCY);

  // for (let w = 0; w < totalWalletIterations; w++) {
  //   const batchStart = w * WALLET_CONCURRENCY;
  //   const batchEnd = Math.min(batchStart + WALLET_CONCURRENCY, allCreatedClients.length);
  //   const walletBatch = allCreatedClients.slice(batchStart, batchEnd);

  //   console.log(
  //     `\n💳 WALLET Batch ${w + 1}/${totalWalletIterations} (clients ${batchStart + 1}-${batchEnd})`
  //   );

  //   let batchDone = false;
  //   while (!batchDone) {
  //     try {
  //       const walletPollStart = Date.now();

  //       const walletResults: boolean[] = await asyncPool(
  //         WALLET_CONCURRENCY,
  //         walletBatch,
  //         waitForWallet
  //       );

  //       const walletPollEnd = Date.now();
  //       const walletPollingSeconds = (walletPollEnd - walletPollStart) / 1000;

  //       const batchWalletSuccess = walletResults.filter(Boolean).length;

  //       totalWalletSuccess += batchWalletSuccess;
  //       totalBothSuccess += batchWalletSuccess; // wallet success only for created ones

  //       console.log(
  //         `✅ WALLET Batch ${w + 1} done: walletsReady=${batchWalletSuccess}/${walletBatch.length}`
  //       );
  //       console.log(
  //         `⏱️ WALLET Batch ${w + 1} polling time: ${walletPollingSeconds.toFixed(2)}s`
  //       );

  //       batchDone = true;
  //     } catch (err: any) {
  //       if (err.message === "RATE_LIMITED") {
  //         console.warn(
  //           `⚠️ Rate limit during WALLET polling. Waiting ${RATE_LIMIT_DELAY_MS / 1000}s then retrying WALLET batch ${w + 1}...`
  //         );
  //         await sleep(RATE_LIMIT_DELAY_MS);
  //         continue;
  //       }

  //       console.error(
  //         `❌ Unexpected error in WALLET batch ${w + 1}: ${err.message}`
  //       );
  //       batchDone = true;
  //     }
  //   }
  // }

  // ✅ overall time ends AFTER last wallet ready
  console.timeEnd("Load test (wall-clock)");
  const overallEnd = Date.now();
  const overallSeconds = (overallEnd - overallStart) / 1000;

  console.log(
    `\n🏁 Total success: created=${totalCreatedSuccess}, walletsReady=${totalWalletSuccess}, both=${totalBothSuccess} / ${TOTAL_CLIENTS}`
  );
  console.log(`⏱️ Overall time (create start → last wallet ready): ${overallSeconds.toFixed(2)}s`);
}

main();
