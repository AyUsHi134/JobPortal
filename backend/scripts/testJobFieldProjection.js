// Listing projection excludes description

import Job from "../models/Job.js";
import { searchJobs, getActiveJobById } from "../services/jobService.js";

let passCount = 0;
let failCount = 0;
function check(label, condition) {
  if (condition) {
    passCount++;
    console.log(`  PASS  ${label}`);
  } else {
    failCount++;
    console.log(`  FAIL  ${label}`);
  }
}

// Chainable stub records select()
function chainable(resolvedValue) {
  const chain = {
    selectedFields: null,
    select(fields) {
      chain.selectedFields = fields;
      return chain;
    },
    sort() {
      return chain;
    },
    skip() {
      return chain;
    },
    limit() {
      return chain;
    },
    lean() {
      return Promise.resolve(resolvedValue);
    },
  };
  return chain;
}

function hasField(selectedFieldsString, field) {
  return new RegExp(`(^|\\s)${field}(\\s|$)`).test(selectedFieldsString || "");
}

console.log("============================");
console.log(" JOB FIELD PROJECTION — LISTING vs. DETAIL (deterministic, no MongoDB)");
console.log("============================");

console.log("\n[1] searchJobs (GET /api/jobs listing) excludes `description` from its field projection");
{
  const originalFind = Job.find;
  const originalCountDocuments = Job.countDocuments;
  let searchChain;
  Job.find = () => {
    searchChain = chainable([]);
    return searchChain;
  };
  Job.countDocuments = async () => 0;

  await searchJobs({ page: 1, limit: 9 });

  check("a field projection was actually passed to .select()", typeof searchChain.selectedFields === "string" && searchChain.selectedFields.length > 0);
  check("`description` is NOT in the listing projection", !hasField(searchChain.selectedFields, "description"));
  check("other real listing fields are still present (title/company/location)", ["title", "company", "location"].every((f) => hasField(searchChain.selectedFields, f)));

  Job.find = originalFind;
  Job.countDocuments = originalCountDocuments;
}

console.log("\n[2] getActiveJobById (GET /api/jobs/:id detail) still includes `description` — the detail contract is unchanged");
{
  const originalFindOne = Job.findOne;
  let detailChain;
  Job.findOne = () => {
    detailChain = chainable(null);
    return detailChain;
  };

  await getActiveJobById("507f1f77bcf86cd799439011");

  check("a field projection was actually passed to .select()", typeof detailChain.selectedFields === "string" && detailChain.selectedFields.length > 0);
  check("`description` IS still in the detail projection", hasField(detailChain.selectedFields, "description"));

  Job.findOne = originalFindOne;
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");

if (failCount > 0) process.exitCode = 1;
