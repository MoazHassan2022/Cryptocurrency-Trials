import axios from "axios";
import * as fs from "fs";

const file = fs.readFileSync("./logo.png");

console.log('lengthhh', file.length);
async function upload() {
  const presignedUrl = "https://custody-dev-public.s3.amazonaws.com/rox/tokenization/a4821c68-4452-4813-8c99-a6f5daa874ba0?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA3LJ5KKO4QDOYQBHP%2F20250826%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Date=20250826T091744Z&X-Amz-Expires=21600&X-Amz-Signature=d4455f9f197d011bc17b405cbeb7e5e6ce0ccfef08ff54d50bb784d62d0a7b05&X-Amz-SignedHeaders=content-length%3Bhost&x-amz-acl=public-read&x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-meta-filename=logo.png&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject";

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
