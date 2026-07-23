import { processImageMulti } from "./lib/faceRecognition.js";

async function testMultipleFaces() {
  console.log("\n=== Testing Multiple Face Detection ===");
  // A stock photo of a group of people (should contain multiple faces)
  const imageUrl = "https://images.unsplash.com/photo-1511632765486-a01980e01a18?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80";
  const res = await fetch(imageUrl);
  const buffer = await res.arrayBuffer();
  const base64 = "data:image/jpeg;base64," + Buffer.from(buffer).toString('base64');

  console.log("Processing image with processImageMulti...");
  const startTime = Date.now();
  const embeddings = await processImageMulti(base64, "v5");
  const elapsed = Date.now() - startTime;

  console.log(`Detected and processed ${embeddings.length} face(s) in ${elapsed}ms.`);
  embeddings.forEach((emb, i) => {
    console.log(`\nFace #${i + 1}:`);
    console.log(`- Quality Score: ${emb.qualityScore.toFixed(3)}`);
    console.log(`- Algorithm Version: ${emb.algorithmVersion}`);
    console.log(`- Base Embedding Size: ${emb.embedding.length}`);
  });
}

async function run() {
  try {
    await testMultipleFaces();
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

run();
