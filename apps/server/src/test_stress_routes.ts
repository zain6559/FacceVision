/**
 * Face Intelligence Platform — Queue, Social, & Recognition High-Concurrency Stress Test Harness
 */

import app from "./app.js";
import http from "http";

let server: http.Server;

const SYNTHETIC_FACE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHAAAABwCAYAAADG4jT+AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAAOSURBVGiB7EBAAyAAAACAAAWn+1sUjV1xAAAAABJRU5ErkJggg==";

async function runHighConcurrencyStressTest() {
  console.log("=================================================================");
  console.log("  💥 RUNNING HIGH-CONCURRENCY STRESS TEST (Queue, Social, Recognition)");
  console.log("=================================================================");

  server = app.listen(0, async () => {
    const address = server.address() as any;
    const baseUrl = `http://localhost:${address.port}/api`;
    console.log(`[StressServer] Server running on ${baseUrl}`);

    const stats = {
      total: 0,
      success: 0,
      rateLimited: 0,
      failed: 0,
      errors: [] as string[],
      durations: [] as number[],
    };

    const startTime = Date.now();

    async function hammer(name: string, endpoint: string, options: RequestInit = {}) {
      stats.total++;
      const reqStart = Date.now();
      try {
        const res = await fetch(`${baseUrl}${endpoint}`, options);
        const reqDuration = Date.now() - reqStart;
        stats.durations.push(reqDuration);

        if (res.status >= 200 && res.status < 300) {
          stats.success++;
        } else if (res.status === 429) {
          stats.rateLimited++;
        } else {
          stats.failed++;
          const text = await res.text().catch(() => "");
          stats.errors.push(`[${res.status}] ${name} (${endpoint}): ${text.slice(0, 150)}`);
        }
      } catch (err: any) {
        const reqDuration = Date.now() - reqStart;
        stats.durations.push(reqDuration);
        stats.failed++;
        stats.errors.push(`[CRASH/CONN] ${name} (${endpoint}) [${reqDuration}ms]: ${err?.message || err}`);
      }
    }

    console.log("\n⚡ STAGE 1: Queue Ingest High-Concurrency Burst (100 Concurrent Requests)...");
    const queuePromises = Array.from({ length: 100 }, (_, i) =>
      hammer("Queue Ingest", "/queue/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrls: [
            `https://cdn.example.com/media_${i}_1.jpg`,
            `https://cdn.example.com/media_${i}_2.jpg`,
            `https://cdn.example.com/media_${i}_3.jpg`
          ],
          tenantId: `tenant_${i % 5}`,
          projectId: 1,
        }),
      })
    );
    await Promise.all(queuePromises);
    console.log(`✓ Stage 1 Complete. Total so far: ${stats.total}, Success: ${stats.success}, Failed: ${stats.failed}`);

    console.log("\n⚡ STAGE 2: Social Crawl High-Concurrency Burst (50 Concurrent Requests)...");
    const socialPromises = Array.from({ length: 50 }, (_, i) =>
      hammer("Social Crawl", "/social/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: `target_user_${i}`,
          platform: i % 2 === 0 ? "instagram" : "facebook",
          personName: `Target Person ${i}`,
        }),
      })
    );
    await Promise.all(socialPromises);
    console.log(`✓ Stage 2 Complete. Total so far: ${stats.total}, Success: ${stats.success}, Failed: ${stats.failed}`);

    console.log("\n⚡ STAGE 3: Recognition Identify High-Concurrency Burst (50 Concurrent Requests)...");
    const recPromises = Array.from({ length: 50 }, (_, i) =>
      hammer("Recognition Identify", "/recognition/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: SYNTHETIC_FACE_BASE64,
          threshold: 0.70,
        }),
      })
    );
    await Promise.all(recPromises);
    console.log(`✓ Stage 3 Complete. Total so far: ${stats.total}, Success: ${stats.success}, Failed: ${stats.failed}`);

    console.log("\n⚡ STAGE 4: Mixed Ultra-High-Concurrency Burst (150 Mixed Concurrent Requests)...");
    const mixedPromises = [
      ...Array.from({ length: 50 }, (_, i) =>
        hammer("Queue Ingest (Mixed)", "/queue/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaUrls: [`https://cdn.example.com/mixed_${i}.jpg`],
            tenantId: "tenant_mixed",
            projectId: 1,
          }),
        })
      ),
      ...Array.from({ length: 50 }, (_, i) =>
        hammer("Social Crawl (Mixed)", "/social/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: `mixed_target_${i}`,
            platform: "twitter",
            personName: `Mixed Target ${i}`,
          }),
        })
      ),
      ...Array.from({ length: 50 }, (_, i) =>
        hammer("Recognition Identify (Mixed)", "/recognition/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: SYNTHETIC_FACE_BASE64,
            threshold: 0.70,
          }),
        })
      ),
    ];
    await Promise.all(mixedPromises);

    const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(2);
    const avgLatency = Math.round(stats.durations.reduce((a, b) => a + b, 0) / (stats.durations.length || 1));
    const maxLatency = Math.max(...stats.durations, 0);

    console.log("\n=================================================================");
    console.log(`  📊 STRESS TEST RESULTS (Total Time: ${totalTimeSec}s)`);
    console.log("=================================================================");
    console.log(` Total Requests:       ${stats.total}`);
    console.log(` Successful (2xx):     ${stats.success}`);
    console.log(` Rate Limited (429):   ${stats.rateLimited}`);
    console.log(` Failed / Errors:      ${stats.failed}`);
    console.log(` Avg Latency per Req:  ${avgLatency}ms`);
    console.log(` Max Latency:          ${maxLatency}ms`);

    if (stats.errors.length > 0) {
      console.log("\n🚨 ERRORS ENCOUNTERED:");
      const uniqueErrors = Array.from(new Set(stats.errors));
      uniqueErrors.slice(0, 15).forEach((e) => console.log(`  - ${e}`));
    }

    server.close();
    process.exit(stats.failed > 0 ? 1 : 0);
  });
}

runHighConcurrencyStressTest();
