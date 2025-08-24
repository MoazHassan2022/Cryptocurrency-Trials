async function main() {
  for (let i = 0; i < 1000; i++) {
    const myHeaders = new Headers();
    myHeaders.append(
      "User-Agent",
      "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0"
    );
    myHeaders.append("Accept", "application/json");
    myHeaders.append("Accept-Language", "en-US,en;q=0.5");
    myHeaders.append("Accept-Encoding", "gzip, deflate, br, zstd");
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Origin", "https://portal.cdp.coinbase.com");
    myHeaders.append("Connection", "keep-alive");
    myHeaders.append("Referer", "https://portal.cdp.coinbase.com/");
    myHeaders.append(
      "Cookie",
      "cb_dm=35ffcb84-0bd9-41d7-b5f0-03a6eef04cfb; coinbase_device_id=ec2fc50e-4e39-406e-a5ef-c6cc4a85199b; advertising_sharing_allowed={%22value%22:true}; _iidt=qTOfFEWFovR+DDzT5GKeA4SB3e/Sd7k5r+gAwHDP7I6MbU2KLzN+6Podq7XOBLMr+b6Kwzbc/m/W8y8mOK9VqPHZAlWp1vqlIQGQrLY=; cb-gssc=eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJhdXRoX3RpbWUiOjE3NTMxNjk0NDQsImlzcyI6Imh0dHBzOi8vbG9naW4uY29pbmJhc2UuY29tIiwic3ViIjoiMDcxYTNkNTYxNmU1YThmNzNhY2I1MjU3M2Q3ZTg0MDkiLCJleHAiOjE3NTU3NjE0NDQsImlhdCI6MTc1MzE2OTQ0NH0.; _cfuvid=ikF44WDUfiGMnt6aCVXlR7Ed2_bHPOriiDkEv0U_5h0-1755594232804-0.0.1.1-604800000; __cf_bm=nYMtd63OxHa6jat5OeUV1Qn9O5RmvChRZhN.0Fjf9tM-1755594232-1.0.1.1-Eb4mUrgJqqiUkotaJ.FI9yZCWU4wg4NvxJBfYKZ5KTL5W_HzMuFsECbKOHlaSPvnep3TdDRABRrKQ_z7YkyTYQha5mzG6dzR_AVoqNCGrkg; unified-oauth-state-cookie=S75KVDZQJSXWIKQ7LSIL52T34UOOQ3ZOBFBJNUYGGMGIGX3GRQPQ====; identity_device_id=2143b259-ba86-548c-9127-07e90b6e892c; unified-session-manager-cookie=MTc1NTU5NDA0MXxGSUdPdnJaUVJkTXB1M095NU9ReDNGZWJOQXh4d1h3SlJOZDQ3aTE5dUxSdFJyTmxxb21DbXNNVlZXeDBncDJOdjYwZVlWc2NBZGN3eW1leF83bE4wTC03akR2STRfb3l2Ynp2VW52N1VQcW5veFE9fKF56MGNwgR9Q-ZJjmT9epTvJS2AfUHzA63UN32bvK8m"
    );
    myHeaders.append("Sec-Fetch-Dest", "empty");
    myHeaders.append("Sec-Fetch-Mode", "cors");
    myHeaders.append("Sec-Fetch-Site", "same-site");
    myHeaders.append("Priority", "u=0");
    myHeaders.append("TE", "trailers");

    const raw = JSON.stringify({
      network: "base-sepolia",
      address: "0xb5517Db9568E6b9f3015441B6E48ea3B22E20a68",
      token: "eth",
    });

    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };

    fetch(
      "https://cloud-api.coinbase.com/platform/projects/1b203f36-0cf9-4334-a959-92b6665b5ce0/v2/evm/faucet",
      requestOptions as any
    )
      .then((response) => response.text())
      .then((result) => console.log(result))
      .catch((error) => console.error(error));

    await new Promise((resolve) => setTimeout(resolve, 5000 + Math.random()));
  }
}

main().catch(console.error);
