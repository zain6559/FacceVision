/**
 * Face Intelligence Platform — Heavy Stress Test & Destruction Harness
 *
 * Simulates intense concurrent traffic, payload hammering, parallel vector searches,
 * malformed inputs, and connection pool saturation to find system weak points.
 */

import app from "./app.js";
import http from "http";

let server: http.Server;

// Generate a valid synthetic 112x112 base64 image (small JPEG header + noise)
const SYNTHETIC_FACE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHAAAABwCAYAAADG4jT+AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAAOSURBVGiB7EBAAyAAAACAAAWn+1sUjV1xAAAAABJRU5ErkJggg==";

async function runStressTest() {
  console.log("=================================================================");
  console.log("  💥 STARTING HEAVY STRESS & CHAOS TESTING HARNESS 💥");
  console.log("=================================================================");

  server = app.listen(0, async () => {
    const address = server.address() as any;
    const baseUrl = `http://localhost:${address.port}/api`;
    console.log(`[ChaosServer] Target running on ${baseUrl}`);

    const stats = {
      total: 0,
      success: 0,
      rateLimited: 0,
      failed: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();

    // Helper fetch with stats tracking
    async function hammer(endpoint: string, options: RequestInit = {}) {
      stats.total++;
      try {
        const res = await fetch(`${baseUrl}${endpoint}`, options);
        if (res.status === 200 || res.status === 201 || res.status === 400) {
          stats.success++;
        } else if (res.status === 429) {
          stats.rateLimited++;
        } else {
          stats.failed++;
          const text = await res.text().catch(() => "");
          stats.errors.push(`[${res.status}] ${endpoint}: ${text.slice(0, 100)}`);
        }
      } catch (err: any) {
        stats.failed++;
        stats.errors.push(`[CRASH/CONN] ${endpoint}: ${err?.message || err}`);
      }
    }

    console.log("\n⚡ STAGE 1: Parallel Health & Telemetry Burst (100 Concurrent Requests)...");
    const stage1Promises = Array.from({ length: 100 }, () => hammer("/healthz"));
    await Promise.all(stage1Promises);

    console.log("\n⚡ STAGE 2: Heavy API Key & Project Creation Burst (50 Concurrent Requests)...");
    const stage2Promises = Array.from({ length: 50 }, (_, i) =>
      hammer("/enterprise/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Chaos-Project-${i}-${Date.now()}`, tenantId: `tenant_${i}` })
      })
    );
    await Promise.all(stage2Promises);

    console.log("\n⚡ STAGE 3: Heavy Vector Explainability Concurrent Burst (50 Parallel 512-dim XAI Requests)...");
    const dummyA = new Array(512).fill(0).map(() => Math.random());
    const dummyB = new Array(512).fill(0).map(() => Math.random());
    const stage3Promises = Array.from({ length: 50 }, () =>
      hammer("/intelligence/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryEmbedding: dummyA, targetEmbedding: dummyB, targetName: "Chaos_Target" })
      })
    );
    await Promise.all(stage3Promises);

    console.log("\n⚡ STAGE 4: Malformed Payload & Boundary Poisoning (XSS, Prototype Pollution, Null Bytes)...");
    const stage4Promises = [
      hammer("/enterprise/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "<script>alert('XSS')</script>", __proto__: { admin: true } })
      }),
      hammer("/intelligence/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryEmbedding: "not_an_array", targetEmbedding: null })
      }),
      hammer("/recognition/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: "data:image/png;base64,invalid_base64_data!!!" })
      }),
    ];
    await Promise.all(stage4Promises);

    console.log("\n⚡ STAGE 5: High-Throughput Face Identification Hammering (30 Parallel Recognition Queries)...");
    const stage5Promises = Array.from({ length: 30 }, () =>
      hammer("/recognition/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: SYNTHETIC_FACE_BASE64, threshold: 0.85 })
      })
    );
    await Promise.all(stage5Promises);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n=================================================================");
    console.log(`  📊 STRESS TEST RESULTS (Duration: ${duration}s)`);
    console.log("=================================================================");
    console.log(` Total Requests:       ${stats.total}`);
    console.log(` Successful (200/201): ${stats.success}`);
    console.log(` Rate Limited (429):   ${stats.rateLimited}`);
    console.log(` Failed / Errors:      ${stats.failed}`);

    if (stats.errors.length > 0) {
      console.log("\n🚨 SAMPLE ERRORS ENCOUNTERED:");
      const uniqueErrors = Array.from(new Set(stats.errors));
      uniqueErrors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
    }

    server.close();
    process.exit(stats.failed > 10 ? 1 : 0);
  });
}

runStressTest();
