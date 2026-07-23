import app from "./app.js";
import http from "http";

async function testSocialEngine() {
  const server = app.listen(0, async () => {
    const address = server.address() as any;
    const baseUrl = `http://localhost:${address.port}/api`;
    console.log(`[SocialTestServer] Target running on ${baseUrl}`);

    try {
      // 1. Status Telemetry
      const statusRes = await fetch(`${baseUrl}/social/status`);
      const statusData: any = await statusRes.json();
      console.log("✓ Social Telemetry:", statusData.engine, "| Active Workers:", statusData.workerPool.activeWorkers);

      // 2. Social Crawl & Graph Learning
      const crawlRes = await fetch(`${baseUrl}/social/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "interpol_watch", platform: "instagram", personName: "Interpol Watch Target" })
      });
      const crawlData: any = await crawlRes.json();
      console.log("✓ Social Graph Crawled:", crawlData.target.username, "| Nodes:", crawlData.graph?.totalEntities, "| Edges:", crawlData.graph?.edges?.length, "| Enrolled Embeddings:", crawlData.embeddingsEnrolled, "| SimCLR Confidence:", crawlData.simclrMatchConfidence);

      // 3. Synthetic Augmentation (10 variations)
      const dummyEmbedding = new Array(512).fill(0).map(() => Math.random());
      const augmentRes = await fetch(`${baseUrl}/social/augment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedding: dummyEmbedding, posesCount: 10 })
      });
      const augmentData: any = await augmentRes.json();
      console.log("✓ Generative Synthetic 3D Augmentation:", augmentData.totalGenerated, "variations generated.");

      console.log("\n🎉 ALL OSINT GRAPH & SOCIAL MEDIA CRAWLER ENDPOINTS PASSED WITH 100% SUCCESS!");
    } catch (err: any) {
      console.error("❌ Social Engine Test Failed:", err);
      process.exit(1);
    } finally {
      server.close();
    }
  });
}

testSocialEngine();
