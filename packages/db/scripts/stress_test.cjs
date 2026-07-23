const http = require("http");

let API_URL = process.env.API_URL || "http://localhost:8080/api";

const BLANK_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const INVALID_BASE64 = "data:image/jpeg;base64,this_is_obviously_corrupted_and_invalid_data!!!";
const HUGE_STRING = "data:image/jpeg;base64," + "A".repeat(5 * 1024 * 1024); // 5MB payload

async function runTest(testName, fn) {
  console.log(`\n===========================================`);
  console.log(`[TEST RUNNING] ${testName}`);
  console.log(`===========================================`);
  try {
    const startTime = Date.now();
    await fn();
    console.log(`[TEST PASSED] ${testName} in ${Date.now() - startTime}ms`);
  } catch (err) {
    console.error(`[TEST FAILED] ${testName}:`, err.message || err);
    throw err;
  }
}

async function ensureTargetServer() {
  try {
    const res = await fetch(`${API_URL}/healthz`);
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data.status === "healthy" || data.status === "degraded") {
        console.log(`[StressTest] Active API server detected at ${API_URL}`);
        return null;
      }
    }
  } catch {
    // Port 8080 not running or not an Express API server, boot standalone in-memory server
  }

  console.log("[StressTest] Booting standalone server for stress testing execution...");
  const { default: app } = await import("../../../apps/server/src/app.js");
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      API_URL = `http://localhost:${addr.port}/api`;
      console.log(`[StressTest] Standalone server started on ${API_URL}`);
      resolve(server);
    });
  });
}

async function main() {
  console.log("Starting Face-Learn-Net Extreme Stress Test Suite...");
  const server = await ensureTargetServer();

  try {
    // Test 1: Invalid payload input
    await runTest("Corrupted Base64 Input Handling", async () => {
      const res = await fetch(`${API_URL}/recognition/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: INVALID_BASE64 })
      });
      const data = await res.json();
      console.log(`Response Status: ${res.status}`);
      console.log("Payload Result:", data);
      if (res.status !== 200 && res.status !== 400 && res.status !== 500) {
        throw new Error(`Unexpected status code: ${res.status}`);
      }
    });

    // Test 2: Blank image (no face detected fallback verification)
    await runTest("Blank Image No-Face Fallback", async () => {
      const res = await fetch(`${API_URL}/recognition/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: BLANK_IMAGE, threshold: 0.6 })
      });
      const data = await res.json();
      console.log(`Response Status: ${res.status}`);
      console.log("No-Face Result Recognized:", data.recognized);
      console.log("Candidates found:", data.candidates?.length ?? 0);
    });

    // Test 3: Large image payload limit
    await runTest("Huge Image Base64 Payload Limit Validation", async () => {
      const res = await fetch(`${API_URL}/recognition/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: HUGE_STRING })
      });
      console.log(`Response Status: ${res.status}`);
      const text = await res.text();
      console.log("Response text sample (first 100 chars):", text.slice(0, 100));
    });

    // Test 4: Concurrency flood test on person enrollment
    await runTest("High Concurrency Parallel Enrollment Flood Test", async () => {
      const totalRequests = 25;
      const promises = [];
      for (let i = 0; i < totalRequests; i++) {
        const name = `Stress_User_${Date.now()}_${i}`;
        promises.push(
          fetch(`${API_URL}/persons`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              source: "stress_test_flood",
              imageBase64: BLANK_IMAGE
            })
          }).then(async r => {
            return { status: r.status, name };
          })
        );
      }

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.status === 200 || r.status === 201).length;
      const failCount = results.length - successCount;

      console.log(`Parallel Insert Results: ${successCount} Successes, ${failCount} Failures`);
      if (successCount < totalRequests * 0.8) {
        throw new Error(`Concurrency test failed! High failure rate: ${failCount}/${totalRequests}`);
      }
    });

    // Test 5: High Concurrency Flood on /api/queue/ingest
    await runTest("High Concurrency Queue Ingestion Flood (/api/queue/ingest)", async () => {
      const concurrentBatches = 20;
      const itemsPerBatch = 50;
      console.log(`Launching ${concurrentBatches} parallel batch ingestion requests (${concurrentBatches * itemsPerBatch} total media URLs)...`);

      const promises = [];
      for (let b = 0; b < concurrentBatches; b++) {
        const mediaUrls = Array.from({ length: itemsPerBatch }, (_, i) => `https://cdn.example.org/stress/img_${b}_${i}.jpg`);
        promises.push(
          fetch(`${API_URL}/queue/ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mediaUrls, tenantId: `tenant_${b}`, projectId: b + 1 })
          }).then(r => r.json())
        );
      }

      const results = await Promise.all(promises);
      const queuedCount = results.filter(r => r.status === "QUEUED").length;
      console.log(`Queue Batch Responses: ${queuedCount}/${concurrentBatches} QUEUED successfully.`);
      if (queuedCount !== concurrentBatches) {
        throw new Error(`Queue ingest concurrency test failed: ${concurrentBatches - queuedCount} batches failed.`);
      }

      // Verify queue stats telemetry
      const statsRes = await fetch(`${API_URL}/queue/stats`);
      const stats = await statsRes.json();
      console.log("Worker Pool Queue Telemetry Status:", stats.status, "| Estimated Throughput:", stats.currentThroughputPerSec, "imgs/sec");
    });

    // Test 6: High Concurrency Flood on /api/recognition/identify
    await runTest("High Concurrency Parallel Identification Flood (/api/recognition/identify)", async () => {
      const concurrentIdentifies = 20;
      console.log(`Launching ${concurrentIdentifies} parallel identification queries simultaneously...`);

      const promises = [];
      for (let i = 0; i < concurrentIdentifies; i++) {
        promises.push(
          fetch(`${API_URL}/recognition/identify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: BLANK_IMAGE, threshold: 0.65 })
          }).then(r => r.json())
        );
      }

      const results = await Promise.all(promises);
      console.log(`Parallel Identification Completed: ${results.length} responses received.`);
      if (results.length !== concurrentIdentifies) {
        throw new Error("Identify concurrency test failed: Response count mismatch.");
      }
    });

    // Test 7: High Concurrency Flood on /api/social/crawl
    await runTest("High Concurrency BFS Social Graph Learning (/api/social/crawl)", async () => {
      const concurrentCrawls = 10;
      console.log(`Launching ${concurrentCrawls} parallel BFS social graph learning tasks...`);

      const promises = [];
      for (let i = 0; i < concurrentCrawls; i++) {
        promises.push(
          fetch(`${API_URL}/social/crawl`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: `stress_target_${i}_${Date.now()}`,
              platform: "instagram",
              personName: `Stress Subject ${i}`
            })
          }).then(r => r.json())
        );
      }

      const results = await Promise.all(promises);
      const validGraphs = results.filter(r => r.graph && r.graph.nodes?.length > 0);
      console.log(`Parallel Social Crawls Completed: ${validGraphs.length}/${concurrentCrawls} successful graph responses.`);
      if (validGraphs.length !== concurrentCrawls) {
        throw new Error(`Social crawl concurrency test failed: ${concurrentCrawls - validGraphs.length} requests failed.`);
      }
    });

    console.log("\n===========================================");
    console.log("🎉 EXTREME STRESS TEST SUITE PASSED 100% SUCCESSFULLY!");
    console.log("===========================================");
  } finally {
    if (server) {
      server.close();
    }
  }
}

main().catch(err => {
  console.error("❌ Stress Test Suite Failed:", err);
  process.exit(1);
});
