import { join } from "path";
import * as fs from "fs";

function extractWantedPatternFailureIds(wantedPattern: string) {
  const filePath = join(__dirname, "data.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item) => {
      const isWantedPattern =
        item?.payload?.pattern === wantedPattern;

      const hasErrors =
        item?.headers?.["custom-errors"] &&
        item.headers["custom-errors"] !== "[]";

      // Optional: ensure it's from DLQ (failure case)
      const isDlq =
        typeof item.routingKey === "string" &&
        item.routingKey.includes("dlq");

      return isWantedPattern && hasErrors && isDlq;
    })
    .map((item) => item.id);
}

async function main() {
  const failureIds = extractWantedPatternFailureIds("securityTokenOperation");
  console.log(failureIds);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});