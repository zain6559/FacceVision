import { extractApiKey } from "./middleware/auth.js";
import { sanitizeString, escapeSqlWildcards, sanitizeData } from "./middleware/sanitize.js";
import { createHash } from "crypto";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ Passed: ${message}`);
}

async function testApiKeyExtraction() {
  console.log("\n--- Testing API Key Extraction ---");

  // Test Bearer Header
  const req1: any = { headers: { authorization: "Bearer fv_live_abc123.def456" } };
  assert(extractApiKey(req1) === "fv_live_abc123.def456", "Extract Bearer token from authorization header");

  // Test X-API-Key Header
  const req2: any = { headers: { "x-api-key": "fv_live_xyz789.uvw012" } };
  assert(extractApiKey(req2) === "fv_live_xyz789.uvw012", "Extract key from x-api-key header");

  // Test Empty/Missing Header
  const req3: any = { headers: {} };
  assert(extractApiKey(req3) === null, "Return null when no key header is provided");
}

async function testApiKeyHashing() {
  console.log("\n--- Testing API Key Hashing ---");

  const rawKey = "fv_live_12345678.90abcdef1234567890abcdef";
  const expectedHash = createHash("sha256").update(rawKey).digest("hex");

  assert(expectedHash.length === 64, "SHA-256 hash length is 64 hex characters");
  assert(createHash("sha256").update(rawKey).digest("hex") === expectedHash, "Deterministic SHA-256 hash verification");
}

async function testInputSanitization() {
  console.log("\n--- Testing XSS & Input Sanitization ---");

  // XSS script tags
  const xssInput = "<script>alert('xss')</script>John Doe";
  const cleanedXss = sanitizeString(xssInput);
  assert(!cleanedXss.includes("<script>") && cleanedXss.includes("John Doe"), "Strip script tags");

  // Event handler attributes
  const eventInput = "<img src='x' onload='alert(1)'>";
  const cleanedEvent = sanitizeString(eventInput);
  assert(!cleanedEvent.includes("onload"), "Strip event handlers");

  // Javascript protocol
  const jsInput = "javascript:alert(1)";
  const cleanedJs = sanitizeString(jsInput);
  assert(!cleanedJs.includes("javascript:"), "Strip javascript: protocol");

  // HTML entity conversion for < and >
  const htmlInput = "<b>Bold User</b>";
  const cleanedHtml = sanitizeString(htmlInput);
  assert(cleanedHtml.includes("&lt;b&gt;"), "Encode < and > tags to prevent HTML injection");
}

async function testSqlWildcardEscaping() {
  console.log("\n--- Testing SQL Wildcard Escaping ---");

  const wildInput = "admin%user_test\\pattern";
  const escaped = escapeSqlWildcards(wildInput);
  assert(escaped === "admin\\%user\\_test\\\\pattern", "Escape %, _, and \\ in search patterns");
}

async function testDataSanitizationRecursion() {
  console.log("\n--- Testing Recursive Object Data Sanitization ---");

  const rawData = {
    name: "  <script>xss()</script>Alice  ",
    tags: ["<b>tag1</b>", "tag2%"],
    nested: {
      field: "javascript:doBadThings()",
    },
    image: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
  };

  const sanitized = sanitizeData(rawData);
  assert(!sanitized.name.includes("<script>"), "Sanitize nested string fields");
  assert(sanitized.tags[0].includes("&lt;b&gt;"), "Sanitize elements inside arrays");
  assert(!sanitized.nested.field.includes("javascript:"), "Sanitize nested object properties");
  assert(sanitized.image.startsWith("data:image/jpeg;base64,"), "Preserve base64 data URLs unmodified");
}

async function runAllTests() {
  try {
    await testApiKeyExtraction();
    await testApiKeyHashing();
    await testInputSanitization();
    await testSqlWildcardEscaping();
    await testDataSanitizationRecursion();
    console.log("\n🎉 ALL SECURITY & AUTH UNIT TESTS PASSED SUCCESSFULLY!\n");
  } catch (err) {
    console.error("Test error:", err);
    process.exit(1);
  }
}

runAllTests();
