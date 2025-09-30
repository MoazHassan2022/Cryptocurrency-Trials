import axios from "axios";
import * as fs from "fs";

const file = fs.readFileSync("./logo.png");

console.log('lengthhh', file.length);
async function upload() {
  const presignedUrl = "https://custody-prod-public.s3.amazonaws.com/automation/tokenization/a02704db-1029-4ebe-b568-cb6f0bde2e5c0?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA3LJ5KKO4ZGV2KUOQ%2F20250930%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Date=20250930T103040Z&X-Amz-Expires=21600&X-Amz-Signature=c925e34c8b73edf69d25592e097304aedb85106a958e5683e6a829ce46b5fffd&X-Amz-SignedHeaders=content-length%3Bhost&x-amz-acl=public-read&x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-meta-filename=logo&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject";

  await axios.put(presignedUrl, file, {
    headers: {
      "Content-Type": "image/png",
    },
  });

  console.log("✅ Upload successful");
}

upload().catch(err => {
  console.error("❌ Upload failed", err.response?.status, err.response?.data);
});
