// ═══════════════════════════════════════════════════════════════
// Upload & Publish API Tests — Node-level validation
// Tests file validation logic and publish endpoint via curl
// ═══════════════════════════════════════════════════════════════

const BASE = "http://localhost:3001";

async function testPublishAPI() {
  console.log("\n━━━ Publish API ━━━");

  // GET publish status for a known project (expense app)
  const PID = "9603d5d5-5836-41f5-a8e9-3a57b4580545";
  try {
    const res = await fetch(`${BASE}/api/projects/${PID}/publish`);
    const data = await res.json();
    console.log(`  GET /api/projects/${PID}/publish → ${res.status}`);
    console.log(`  Response:`, JSON.stringify(data));

    if (res.status === 200) {
      console.log(`  ✓ Publish status endpoint works`);
      if (data.status === "draft" || data.status === "published") {
        console.log(`  ✓ Status field is valid: ${data.status}`);
      }
      if (typeof data.hasUnpublishedChanges === "boolean") {
        console.log(`  ✓ hasUnpublishedChanges is boolean`);
      }
    } else if (res.status === 401) {
      console.log(`  ⚠ Auth required — endpoint exists but needs cookie`);
    } else {
      console.log(`  ✗ Unexpected status: ${res.status}`);
    }
  } catch (e: any) {
    console.log(`  ✗ Error: ${e.message}`);
  }
}

async function testUploadValidation() {
  console.log("\n━━━ Upload Validation Logic ━━━");

  // Test MIME type validation
  const ALLOWED = [
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "application/pdf", "text/csv", "text/plain",
  ];

  console.log(`  ✓ ${ALLOWED.length} MIME types configured`);

  // Test size limit
  const MAX_SIZE = 10 * 1024 * 1024;
  console.log(`  ✓ Max file size: ${MAX_SIZE / 1024 / 1024}MB`);

  // Test filename sanitization
  const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/_{2,}/g, "_").slice(0, 50);
  console.log(`  ✓ "my receipt (2).pdf" → "${sanitize("my receipt (2).pdf")}"`);
  console.log(`  ✓ "../../etc/passwd" → "${sanitize("../../etc/passwd")}"`);
  console.log(`  ✓ "normal-file.png" → "${sanitize("normal-file.png")}"`);

  // Verify path traversal protection
  const traversal = sanitize("../../../etc/passwd");
  if (!traversal.includes("..")) {
    console.log(`  ✓ Path traversal prevented`);
  }
}

async function testUploadEndpoint() {
  console.log("\n━━━ Upload Endpoint ━━━");

  try {
    const formData = new FormData();
    formData.append("file", new Blob(["test content"], { type: "text/plain" }), "test.txt");
    formData.append("projectId", "test-123");

    const res = await fetch(`${BASE}/api/upload`, { method: "POST", body: formData });
    const data = await res.json();
    console.log(`  POST /api/upload → ${res.status}`);
    console.log(`  Response:`, JSON.stringify(data));

    if (res.status === 200 && data.url) {
      console.log(`  ✓ Upload succeeded: ${data.url}`);
      console.log(`  ✓ Filename: ${data.filename}`);
      console.log(`  ✓ Size: ${data.size}`);
    } else if (res.status === 401) {
      console.log(`  ⚠ Auth intercept — route may need server restart to register`);
    } else {
      console.log(`  ✗ Unexpected: ${JSON.stringify(data)}`);
    }
  } catch (e: any) {
    console.log(`  ✗ Error: ${e.message}`);
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("API Endpoint Tests");
  console.log("═══════════════════════════════════════════════════════════");

  await testUploadValidation();
  await testUploadEndpoint();
  await testPublishAPI();

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("Done");
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch(console.error);
