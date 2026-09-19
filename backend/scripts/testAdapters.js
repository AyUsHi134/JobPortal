// Read-only adapter verification script

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Resolve paths from file location
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { fetchAdzunaJobs } = await import("../integrations/jobs/adzunaAdapter.js");
const { fetchRemoteOKJobs } = await import("../integrations/jobs/remoteOkAdapter.js");

function printResultSummary(label, result) {
  console.log(`\n--- ${label} ---`);
  console.log("ok:", result.ok);
  if (!result.ok) {
    console.log("error.type:", result.error.type);
    console.log("error.message:", result.error.message);
    if (result.error.status) console.log("error.status:", result.error.status);
    return;
  }
  console.log("meta:", JSON.stringify(result.meta, null, 2));
  console.log("jobs.length:", result.jobs.length);
  if (result.jobs[0]) {
    console.log("sample field names (job[0]):", Object.keys(result.jobs[0]));
  }
}

function printSampleTitles(result, n = 3) {
  result.jobs.slice(0, n).forEach((j, i) => {
    const title = j.title || j.position || "(no title field)";
    const company =
      (j.company && (j.company.display_name || j.company)) || "(no company field)";
    console.log(`  ${i + 1}. ${title} — ${company}`);
  });
}

async function testAdzuna() {
  console.log("\n============================");
  console.log(" ADZUNA ADAPTER TEST");
  console.log("============================");

  // Missing-credentials path check
  const savedAppId = process.env.ADZUNA_APP_ID;
  const savedAppKey = process.env.ADZUNA_APP_KEY;
  delete process.env.ADZUNA_APP_ID;
  delete process.env.ADZUNA_APP_KEY;
  const missingCredsResult = await fetchAdzunaJobs({ country: "in", what: "software developer" });
  printResultSummary("Missing credentials (expected failure)", missingCredsResult);
  process.env.ADZUNA_APP_ID = savedAppId;
  process.env.ADZUNA_APP_KEY = savedAppKey;

  if (!savedAppId || !savedAppKey) {
    console.log(
      "\nADZUNA_APP_ID/ADZUNA_APP_KEY not present in backend/.env — skipping live tests."
    );
    return;
  }

  // Invalid credentials path check
  process.env.ADZUNA_APP_ID = "invalid-test-id";
  process.env.ADZUNA_APP_KEY = "invalid-test-key";
  const invalidCredsResult = await fetchAdzunaJobs({ country: "in", what: "software developer" });
  printResultSummary("Invalid credentials (expected auth_failed)", invalidCredsResult);
  process.env.ADZUNA_APP_ID = savedAppId;
  process.env.ADZUNA_APP_KEY = savedAppKey;

  // 2. Real India tech query.
  const page1 = await fetchAdzunaJobs({
    country: "in",
    what: "software developer",
    page: 1,
    results_per_page: 20,
  });
  printResultSummary("India, what=software developer, page 1", page1);
  if (page1.ok) printSampleTitles(page1);

  // Pagination check
  const page2 = await fetchAdzunaJobs({
    country: "in",
    what: "software developer",
    page: 2,
    results_per_page: 20,
  });
  printResultSummary("India, what=software developer, page 2", page2);
  if (page1.ok && page2.ok) {
    const ids1 = new Set(page1.jobs.map((j) => j.id));
    const ids2 = new Set(page2.jobs.map((j) => j.id));
    const overlap = [...ids2].filter((id) => ids1.has(id)).length;
    console.log(`Pagination check: ${overlap} overlapping ids between page 1 and page 2 (expect 0).`);
  }

  // Page-size clamp check
  const clampCheck = await fetchAdzunaJobs({
    country: "in",
    what: "software developer",
    page: 1,
    results_per_page: 100,
  });
  printResultSummary("results_per_page=100 (expect clamp to 50)", clampCheck);
}

async function testRemoteOK() {
  console.log("\n============================");
  console.log(" REMOTEOK ADAPTER TEST");
  console.log("============================");

  const result = await fetchRemoteOKJobs({});
  printResultSummary("Live RemoteOK feed", result);
  if (result.ok) printSampleTitles(result);
}

await testAdzuna();
await testRemoteOK();

console.log("\nDone. No database connection was made and no jobs were written anywhere.");
