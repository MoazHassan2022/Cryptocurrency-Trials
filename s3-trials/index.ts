import "dotenv/config";
import { join } from "path";
import * as fs from "fs";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

function mustGet(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function makeS3Client() {
  return new S3Client({
    region: mustGet("BUCKETREGION"),
    credentials: {
      accessKeyId: mustGet("BUCKETKEY"),
      secretAccessKey: mustGet("BUCKETSECRET"),
    },
    forcePathStyle: true,
  });
}

async function getEnvObjectNames(env: string): Promise<string[]> {
  const s3 = makeS3Client();

  const bucket = mustGet("BUCKETNAME");

  const matched: string[] = [];
  let token: string | undefined = undefined;
  let page = 1;
  while (true) {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );

    const keys =
      res.Contents?.map((o) => o.Key).filter((k): k is string => !!k) ?? [];

    for (const key of keys) {
      if (key.toLocaleLowerCase().includes(env) && !key.toLocaleLowerCase().includes('dev-server')) matched.push(key);
    }

    if (res.IsTruncated && res.NextContinuationToken) {
      token = res.NextContinuationToken;
    } else {
      break;
    }

    console.log(`Processed page ${page}, found ${matched.length} matches so far...`);
    page++;
  }

  console.log(`Processed page ${page}, found ${matched.length} matches in total.`);

  return matched;
}

async function writeMatchedKeys(objectNames: string[]) {
  const filePath = join(__dirname, "matched-keys.json");
  fs.writeFileSync(filePath, JSON.stringify(objectNames, null, 2));
  console.log(`Wrote ${objectNames.length} object names to ${filePath}`);
}

async function readMatchedKeys() {
  const filePath = join(__dirname, "matched-keys.json");
  const objectNames: string[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  console.log(`Read ${objectNames.length} object names from ${filePath}`);

  return objectNames;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function deleteKeysBatch(keys: string[]) {
  const s3 = makeS3Client();
  const bucket = mustGet("BUCKETNAME");

  const success: string[] = [];
  const failed: Array<{ key: string; code?: string; message?: string }> = [];

  const batches = chunk(keys, 1000);

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];

    try {
      const res = await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: batch.map((Key) => ({ Key })),
            Quiet: false,
          },
        })
      );

      const deleted = res.Deleted?.map((d) => d.Key).filter(Boolean) as string[] | undefined;
      const errors = res.Errors ?? [];

      if (deleted?.length) success.push(...deleted);

      for (const e of errors) {
        failed.push({
          key: e.Key ?? "(unknown)",
          code: e.Code,
          message: e.Message,
        });
      }

      console.log(
        `Batch ${b + 1}/${batches.length}: requested=${batch.length}, deleted=${
          deleted?.length ?? 0
        }, failed=${errors.length}`
      );
    } catch (e: any) {
      // If the whole batch request fails (permissions/network), mark all keys as failed
      const msg = e?.message ?? String(e);
      console.error(`Batch ${b + 1}/${batches.length} FAILED: ${msg}`);

      for (const key of batch) {
        failed.push({ key, message: msg });
      }
    }
  }

  fs.writeFileSync(
    join(__dirname, "delete-success.txt"),
    success.join("\n") + (success.length ? "\n" : "")
  );
  fs.writeFileSync(
    join(__dirname, "delete-failed.json"),
    JSON.stringify(failed, null, 2)
  );

  console.log(`\nDelete summary:`);
  console.log(`- Success: ${success.length}`);
  console.log(`- Failed : ${failed.length}`);
  console.log(`Wrote: delete-success.txt, delete-failed.json`);
}

async function main() {
  // const objectNames = await getEnvObjectNames("dev");

  // console.log(`Found ${objectNames.length} object names`);
  
  // await writeMatchedKeys(objectNames);

  // const objectNames = await readMatchedKeys();

  // const objectNames = ["1-1-PROD-1/keydata.json"];

  // await deleteKeysBatch(objectNames);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
