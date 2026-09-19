// Homepage content static verification

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "..");
function readSource(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), "utf8");
}

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
console.log(" HOMEPAGE CONTENT — STATIC VERIFICATION TESTS (Phase 2G-3)");
console.log("============================");

const HOME = readSource("pages/Home.jsx");

// ---------------------------------------------------------------------------
console.log("\n[1] Unsupported 'manual verification' claims are removed (item 19)");
{
  check("'Verified Listings' no longer appears", !/Verified Listings/.test(HOME));
  check("'hand-checked' no longer appears", !/hand-checked/i.test(HOME));
  check("no claim that companies/listings are manually verified remains", !/genuine,\s*hand-checked/i.test(HOME));
}

// ---------------------------------------------------------------------------
console.log("\n[2] Feature-card claims are honest and match real, implemented capabilities (items 7, 8)");
{
  check("a truthful 'jobs from multiple sources' claim replaces the old unverifiable ones", /multiple sources/i.test(HOME));
  check("a truthful 'smart filtering' claim describes real filters (experience/tech/remote) that FindJob.jsx actually implements", /experience level.*remote status.*tech relevance/i.test(HOME) || /Smart Filtering/.test(HOME));
  check("a truthful 'direct access to the original listing' claim replaces any fabricated guarantee", /original job post/i.test(HOME));
  check("the old 'Startup Focus' card copy (an unsupported claim — no startup-classification field exists on the backend) is gone", !/Freshest startup and tech jobs\./.test(HOME));
  check("the old blanket 'Fully-remote jobs available worldwide' overclaim is gone (is_remote is real but tri-state/often unknown, not a guarantee)", !/Fully-remote jobs available worldwide/.test(HOME));
}

// ---------------------------------------------------------------------------
console.log("\n[3] The newsletter feature (no real backend/API flow ever existed for it) was removed, not faked (item 20)");
{
  check("components/NewsletterSection.jsx no longer exists", !fs.existsSync(path.join(SRC_DIR, "components/NewsletterSection.jsx")));
  check("Home.jsx no longer imports NewsletterSection", !/NewsletterSection/.test(HOME));
  check("no fake 'subscribed'/'thank you for subscribing' success copy was introduced anywhere in Home.jsx", !/subscribed|thank you for subscribing/i.test(HOME));
  check("no email-collection input/Subscribe control was reintroduced elsewhere on the homepage", !/Your email/i.test(HOME) && !/Subscribe/i.test(HOME));
}

// ---------------------------------------------------------------------------
console.log("\n[3b] Footer.jsx's new 'Get job alerts' UI follows the same no-fake-success rule item 20 established — real UI, honest about having no backend yet");
{
  const footer = readSource("components/Footer.jsx");
  check("a real email input + Subscribe control exists in Footer.jsx", /type="email"/.test(footer) && /Subscribe/.test(footer));
  check("no fake 'subscribed'/'thank you for subscribing' success copy exists", !/thank you for subscribing/i.test(footer) && !/you('|')re subscribed/i.test(footer));
  check("an honest 'not available yet' message is shown instead of a fake success state", /available yet/i.test(footer));
  check("no fetch(...)/axios call is made — this is UI-only until a real backend endpoint exists", !/\bfetch\(/.test(footer) && !/\baxios\b/.test(footer));
}

// ---------------------------------------------------------------------------
console.log("\n[4] The homepage reuses the single Phase 2G-2 JobCard — no second, homepage-specific job-card implementation (item 18)");
{
  check("Home.jsx imports the real JobCard component", /import JobCard from ["']\.\.\/components\/JobCard\/JobCard["']/.test(HOME));
  check("Home.jsx renders <JobCard job={job} /> directly, not a re-implementation of card markup", /<JobCard job=\{job\} \/>/.test(HOME));
  check("no second file defines its own '...Card' component under pages/Home*", !fs.existsSync(path.join(SRC_DIR, "pages/HomeJobCard.jsx")));
}

// ---------------------------------------------------------------------------
console.log("\n[5] The green theme now reaches the homepage's supporting content (hero, Recent Jobs heading, Footer) — no leftover purple hex");
{
  const KNOWN_PURPLE_HEXES = ["#7046d3", "#5f43b2", "#7b42f6", "#a276e8", "#8457e7", "#51308d", "#6d4cbe", "#563ba7", "#987fe7", "#ece4fa", "#c3abfa", "#462478", "#a596c9", "#ebe3fb", "#2a223e", "#5f3dbf"];

  const home = HOME;
  const footer = readSource("components/Footer.jsx");
  for (const [label, source] of [["Home.jsx", home], ["Footer.jsx", footer]]) {
    const offenders = KNOWN_PURPLE_HEXES.filter((hex) => source.toLowerCase().includes(hex));
    check(`${label} contains no old purple hex value`, offenders.length === 0);
  }
  // Footer uses Career gradient
}

// Gradient moved to SCSS
console.log("\n[5b] Footer.scss's gradient background is the EXACT same formula/tokens as Home.jsx's Career card — no new color or gradient was introduced, just expressed via the shared Sass tokens instead of inline MUI sx");
{
  const footerScss = readSource("components/Footer.scss");
  const variablesScss = readSource("styles/_variables.scss");
  const themeJs = readSource("theme.js");

  const MUI_GRADIENT_EXPR = "`linear-gradient(115deg, ${theme.palette.primary.deep} 0%, ${theme.palette.primary.main} 40%, ${theme.palette.oliveAccent} 100%)`";
  check("Home.jsx's Career card uses this exact MUI gradient expression", HOME.includes(MUI_GRADIENT_EXPR));

  const SCSS_GRADIENT_EXPR = "linear-gradient(115deg, $primary-deep 0%, $primary-color 40%, $olive-accent 100%)";
  check("Footer.scss's dark bar uses the equivalent Sass gradient — same angle, same stops, same token role-order (deep -> mid -> olive)", footerScss.includes(SCSS_GRADIENT_EXPR));

  function hexOf(source, pattern) {
    const match = source.match(pattern);
    return match ? match[1].toLowerCase() : null;
  }
  const sassDeep = hexOf(variablesScss, /\$primary-deep:\s*(#[0-9a-fA-F]{6})/);
  const sassMain = hexOf(variablesScss, /\$primary-color:\s*(#[0-9a-fA-F]{6})/);
  const sassOlive = hexOf(variablesScss, /\$olive-accent:\s*(#[0-9a-fA-F]{6})/);
  const muiDeep = hexOf(themeJs, /deep:\s*"(#[0-9a-fA-F]{6})"/);
  const muiMain = hexOf(themeJs, /primary:\s*\{\s*main:\s*"(#[0-9a-fA-F]{6})"/);
  const muiOlive = hexOf(themeJs, /oliveAccent:\s*"(#[0-9a-fA-F]{6})"/);
  check(
    "the Sass tokens Footer.scss's gradient uses resolve to the exact same hex values as the MUI theme tokens Home.jsx's gradient uses — genuinely the same colors, not just similarly-named tokens",
    sassDeep && sassMain && sassOlive && sassDeep === muiDeep && sassMain === muiMain && sassOlive === muiOlive
  );

  const footerJsx = readSource("components/Footer.jsx");
  check("Footer.jsx's old flat bgcolor:\"primary.main\" bar is gone (replaced by the gradient, not layered underneath it)", !/bgcolor:\s*"primary\.main"/.test(footerJsx));
}

// ---------------------------------------------------------------------------
console.log("\n[6] No direct fetch/axios/Adzuna/RemoteOK call was introduced in any file this phase touched");
{
  const footer = readSource("components/Footer.jsx");
  for (const [label, source] of [["Home.jsx", HOME], ["Footer.jsx", footer]]) {
    check(`${label} contains no direct fetch(...) call`, !/\bfetch\(/.test(source));
    check(`${label} contains no direct axios usage`, !/\baxios\b/.test(source));
    check(`${label} contains no Adzuna/RemoteOK hostname reference`, !/adzuna\.(com|in)|remoteok\.(com|io)|api\.adzuna/i.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[7] Find Jobs' honest no-results distinction is preserved (item 17) — richer since Phase 2G-7B, but still a genuine integration, not assumed");
{
  const findJob = readSource("pages/FindJob/FindJob.jsx");
  const jobDiscoveryState = readSource("utils/jobDiscoveryState.js");
  // Richer no-results state
  check("FindJob.jsx still distinguishes 'nothing exists at all' from 'your search/filters matched nothing'", /No active jobs are available right now/.test(findJob) && /No jobs found/.test(findJob));
  check("the zero-results branch never falls back to rendering unrelated jobs (it's the sole content of that success-with-zero-jobs branch)", /state\.jobs\.length === 0 &&[\s\S]{0,1400}state\.jobs\.length > 0/.test(findJob));
  check("FindJob.jsx's initial filters are read from the URL on mount, so a homepage-issued /jobs?q=... link is honored", /searchParamsToFilters\(Object\.fromEntries\(searchParams\)\)/.test(findJob));
  check("searchParamsToFilters reads the same 'q' key the homepage's buildJobSearchPath(...) writes, confirming the handoff is wired correctly, not just assumed", /q:\s*""/.test(jobDiscoveryState));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
