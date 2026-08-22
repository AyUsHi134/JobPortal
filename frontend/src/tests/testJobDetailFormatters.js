// Deterministic verification for the Job Detail page's description
// formatting (frontend/src/utils/jobDisplay.js's
// sanitizeDescriptionText/descriptionToParagraphs, added in Phase 2D).
// The shared location/salary/experience/remote/tech/source/date/
// apply-link formatters JobDetail.jsx also uses are already covered by
// src/tests/testJobDisplay.js (Phase 2C) — reused here unchanged, not
// re-tested, since they are the exact same functions. Run via
// `node src/tests/testJobDetailFormatters.js`.

import { sanitizeDescriptionText, descriptionToParagraphs } from "../utils/jobDisplay.js";

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

console.log("============================");
console.log(" JOB DETAIL DESCRIPTION FORMATTING — DETERMINISTIC TESTS");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] sanitizeDescriptionText/descriptionToParagraphs — missing/empty description never fabricated");
{
  check("null description -> sanitize returns null", sanitizeDescriptionText(null) === null);
  check("undefined description -> sanitize returns null", sanitizeDescriptionText(undefined) === null);
  check("empty string -> sanitize returns null", sanitizeDescriptionText("") === null);
  check("whitespace-only string -> sanitize returns null", sanitizeDescriptionText("   \n  ") === null);
  check("non-string value -> sanitize returns null, never throws", sanitizeDescriptionText(12345) === null);

  check("null description -> paragraphs is an empty array", Array.isArray(descriptionToParagraphs(null)) && descriptionToParagraphs(null).length === 0);
  check("missing description -> paragraphs is an empty array", descriptionToParagraphs(undefined).length === 0);
  check("empty string -> paragraphs is an empty array", descriptionToParagraphs("").length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[2] Plain-text descriptions preserve readable paragraphs/line breaks (no HTML involved)");
{
  const plain = "Line one.\nLine two.\n\nLine three after a blank line.";
  const paragraphs = descriptionToParagraphs(plain);
  check("plain text splits into 3 non-empty paragraphs, blank lines collapsed", paragraphs.length === 3);
  check("paragraph 1 content preserved", paragraphs[0] === "Line one.");
  check("paragraph 3 content preserved", paragraphs[2] === "Line three after a blank line.");

  const singleLine = "Just one line, no breaks at all.";
  check("a single-line description becomes exactly one paragraph", descriptionToParagraphs(singleLine).length === 1);
}

// ---------------------------------------------------------------------------
console.log("\n[3] HTML-bearing descriptions are stripped to safe plain text, never re-injected as markup");
{
  const html = "<p>First paragraph with <strong>bold</strong> text.</p><p>Second paragraph.</p>";
  const paragraphs = descriptionToParagraphs(html);
  check("no tag characters ('<'/'>') survive in any paragraph", paragraphs.every((p) => !p.includes("<") && !p.includes(">")));
  check("2 paragraphs recovered from </p> boundaries", paragraphs.length === 2);
  check("bold text content is preserved as plain text (not markup)", paragraphs[0].includes("bold"));
  check("second paragraph content preserved", paragraphs[1] === "Second paragraph.");

  const withBreaksAndList = "Intro line.<br>Requirements:<ul><li>Node.js</li><li>React</li></ul>";
  const listParagraphs = descriptionToParagraphs(withBreaksAndList);
  check("<br> becomes a line break", listParagraphs.includes("Intro line."));
  check("list items become their own readable lines, tag-free", listParagraphs.some((p) => p.includes("Node.js")) && listParagraphs.some((p) => p.includes("React")));
  check("no raw '<li>'/'<ul>' markup leaks through anywhere", listParagraphs.every((p) => !/<\/?(li|ul)/i.test(p)));

  const scriptAttempt = "<script>alert('xss')</script>Safe text after.";
  const scriptParagraphs = descriptionToParagraphs(scriptAttempt);
  check("a <script> tag is stripped entirely, never reaches the output as an executable tag", !scriptParagraphs.some((p) => p.includes("<script")));
  check("the surrounding safe text still survives as plain text", scriptParagraphs.some((p) => p.includes("Safe text after.")));
}

// ---------------------------------------------------------------------------
console.log("\n[4] HTML entities are decoded to their real characters, not left as literal escape codes");
{
  const withEntities = "Salary: 80k &amp; benefits, apply if you know C&#39;s &lt;pointer&gt; semantics.";
  const text = sanitizeDescriptionText(withEntities);
  check("&amp; decodes to '&'", text.includes("80k & benefits"));
  check("&#39; decodes to an apostrophe", text.includes("C's"));
  check("&lt;/&gt; decode to real angle brackets as plain text (not re-parsed as a tag)", text.includes("<pointer>"));
}

// ---------------------------------------------------------------------------
console.log("\n[5] descriptionToParagraphs never invents content that wasn't in the source description");
{
  const original = "Exactly this text, nothing more.";
  const paragraphs = descriptionToParagraphs(original);
  check("the single paragraph's content matches the source exactly (no added filler)", paragraphs.length === 1 && paragraphs[0] === original);
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
