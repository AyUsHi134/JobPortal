# Phase 2G-7C Report — Homepage Visual Refinement

**Scope:** a curved/wave hero transition (replacing the straight gradient edge from the prior corrections), a deeper search-card overlap so it genuinely straddles the hero/section boundary, a subtle accent underline beneath the centered "Recent Jobs" heading, a full JobCard content reorder (Company → Title → Location → Salary → Posted date → Tags/badges → Footer) with the badge/tag area now conditionally rendered instead of reserving fixed empty space, a bookmark icon added to the Save control, and a View Details button switched to a quieter outlined treatment to complete the Sign Up/Search/View Details hierarchy. No backend file, API, authentication, saved-job state/API logic, search/filter/sort/pagination logic, or Job Detail routing/state machine was touched. Phase 2G-7D/E, 2G-6, 2H, and deployment work were not started.

*No image was actually attached to this conversation turn; the written design direction in the brief (curved wave, layered green/olive palette, premium-but-subtle SaaS feel, specific card-content ordering) was used as the concrete spec.*

---

## 1. Files Inspected First

Before changing anything: `PHASE_2G7A_REPORT.md`, `PHASE_2G7B_REPORT.md`, `PHASE_2G7A_CORRECTION_REPORT.md`, `PHASE_2G7A_THEME_CORRECTION_REPORT.md`, and `PHASE_2G7A_FINAL_THEME_REPORT.md` (the full 2G-7A/7B lineage), plus the current `Home.jsx`, `JobCard.jsx`/`.scss`, `Navbar.scss`, `_variables.scss`, and `theme.js` were re-read in full. This confirmed the palette/token architecture (deep/hover/main/olive/sage tones, `$badge-*` semantic pairs, `background.sage`/`background.paper`/`primary.deep`/`oliveAccent` MUI mirrors) was already complete from the prior corrections — this phase only needed to *use* the existing tokens differently (a wave shape, a reordered card, an outlined button), not add new ones.

## 2. Hero / Gradient — Curved Wave Transition

The hero kept its existing 5-stop vertical gradient (deep forest → dark natural green → medium natural green → muted olive → soft sage, all existing theme tokens, unchanged from the prior correction) — its straight bottom edge is what changed. A full-bleed SVG now sits at the hero's bottom edge:

```jsx
<Box component="svg" viewBox="0 0 1440 110" preserveAspectRatio="none" aria-hidden="true"
     sx={{ position: "absolute", left: 0, bottom: -1, width: "100%", height: {xs:34, sm:52, md:70} }}>
  <Box component="path" d="M0,58 C220,20 380,88 620,54 ..." sx={{ fill: (theme) => theme.palette.background.sage, opacity: 0.35 }} />
  <Box component="path" d="M0,72 C260,110 460,50 720,74 ..." sx={{ fill: (theme) => theme.palette.background.sage }} />
</Box>
```

- **Curved, not straight**: two cubic-Bézier wave paths (a faint 35%-opacity echo above a solid one) replace the hard horizontal line.
- **`preserveAspectRatio="none"` + `width: 100%`**: the standard dependency-free technique for a responsive wave — no fixed pixel width anywhere, so it can never cause horizontal overflow at any viewport.
- **Filled with `background.sage` via a `theme` callback**, not a hardcoded hex — the wave's color stays wired to the same token the section below it uses, so a future palette adjustment updates both automatically.
- **No animation** — both paths are static; no `@keyframes`/`animation`/`transition` was added anywhere in this element, per the explicit "no distracting animation" instruction.
- **The fainter path is the "extremely subtle wave/line texture"** the brief allows as optional — a low-opacity echo of the main shape rather than an unrelated pattern, kept genuinely subtle (35% opacity, same color family).
- The hero's own `pb` grew (`{xs:7,sm:10}` → `{xs:10,sm:13,md:15}`) to comfortably fit the wave plus the deeper card overlap (§3) without cramping the hero's text content.

## 3. Search Card — Straddling the Boundary

The card's negative top margin was deepened from `{xs:-5, sm:-7}` to `{xs:-8, sm:-10, md:-11}` — roughly half the search card's own rendered height (~80-96px including its padding), so it now visibly straddles the hero/sage boundary (part over the hero's wave, part over the sage section) rather than merely touching the edge, per this phase's explicit "must NOT simply touch the bottom edge" instruction.

**Unchanged, verified byte-for-byte**: the placeholder (`placeholder="e.g. React Developer"`), the `aria-label`, `validateSearchQuery`/`buildJobSearchPath` wiring, the `onSubmit={handleHeroSearch}` handler, the `background.paper` white card fill, and its `boxShadow: 3` elevation. No floating label/border text was reintroduced — the 2G-7B fix (real placeholder + `aria-label`, no MUI `label` prop) is untouched.

## 4. Recent Jobs Section

**No change was needed to remove the seam** — the search card and Recent Jobs already share one continuous `background.sage` `Box` from the prior correction; re-verified intact (`testDesignSystem.js` [14]). Two small additions:
- **Centered heading**: already centered (`align="center"`, unchanged) — confirmed, not re-implemented.
- **New subtle underline accent**: a short (56px × 3px), rounded bar directly beneath the "Recent Jobs" heading, centered, reusing the existing `primary.main` token — no new color, not a full-width rule, restrained per "do not make the section overly colorful."

Job cards remain warm off-white (`$surface-color`, `JobCard.scss` untouched in this regard) against the sage background — unchanged, still clearly distinguishable.

## 5. Job Card Structure — Reordered

`JobCard.jsx`'s render order changed from `Badges → Company → Title → Location → Skills → Salary → Posted` to the requested `Company → Title → Location → Salary → Posted date → Tags/badges → Footer`. **No formatting/data logic changed** — every field is still computed via the exact same, unmodified `jobDisplay.js` functions (`formatLocation`, `formatSalary`, `formatDatePosted`, `formatRemoteBadge`, `formatExperience`, `formatTechRelevance`, `isDuplicateRemoteLocation`, `getExperienceBadgeTone`); only the JSX render *order* moved.

**The empty-badge-area problem is fixed by construction, not by CSS trickery.** The badges (Remote/Experience/Tech) and skill-chip tags are now grouped into one `job-tags-section` block, rendered only when `hasTagsOrBadges` (`hasBadges || skills.length > 0`) is true:

```jsx
const hasBadges = Boolean(remoteBadgeText || experienceText || techText);
const hasTagsOrBadges = hasBadges || skills.length > 0;
...
{hasTagsOrBadges && (
  <div className="job-tags-section">
    {hasBadges && <div className="job-badges">...</div>}
    {skills.length > 0 && <div className="job-skills">...</div>}
  </div>
)}
```

Previously, the badge row sat *above* the company/title and needed a fixed `min-height: 1.6rem` to keep those elements' position stable regardless of which badges a job had. Now that the badge/tag block sits *after* the posted date (nothing below it needs protecting from a shifting position above it), that fixed reservation is gone entirely — a job with zero badges and zero skills renders no `job-tags-section` element at all, so there is no leftover empty gap before the footer. This was the explicit, deliberate reversal of the earlier Phase 2G-2/2G-7B "fixed top slot" rule, re-documented in both `JobCard.jsx`'s own header comment and the updated tests (§9).

**All honest-data rules preserved, unchanged**: Remote only for `is_remote === true`, Experience only for a recognized level, Tech only for `is_tech_relevant === true`, no duplicate Remote-in-location (`isDuplicateRemoteLocation`, untouched), the existing 3-skill cap (`.slice(0, 3)`, untouched), badge priority order (Remote → Experience → Tech, untouched).

## 6. Card Footer

The footer row's `justify-content: space-between` layout (View Details left, Save right) was already correct and needed no structural change. The Save button gained a bookmark icon — `BookmarkIcon` (filled) when `isSaved`, `BookmarkBorderIcon` (outline) otherwise, from the already-installed `@mui/icons-material` package (confirmed present in `node_modules` before use; no new dependency) — placed inside the same `<button>`, before the existing text label:

```jsx
<button className={`save-btn${isSaved ? " saved" : ""}`} onClick={handleSaveClick} disabled={saveButton.disabled} aria-pressed={isSaved}>
  {isSaved ? <BookmarkIcon fontSize="small" /> : <BookmarkBorderIcon fontSize="small" />}
  {saveButton.label}
</button>
```

This is a **purely visual addition** — `onClick`, `disabled`, `aria-pressed`, and the label text are all byte-for-byte unchanged from before. No Apply/View Original affordance was reintroduced anywhere on the card.

## 7. Button Hierarchy

| Button | Treatment | Change this phase |
|---|---|---|
| **Sign Up** (Navbar) | Filled, `$primary-hover` (deep) default, `$olive-accent` hover, `$primary-deep` active | None — already correct from the prior correction |
| **Search** (Home hero) | Filled, MUI `color="primary"` → `$primary-color` (medium) | None — already correct |
| **View Details** (JobCard) | **Outlined**: `$surface-color` background, `$secondary-color` border/text; hover fills `$sage-color` with `$primary-color` border/text | Changed from a light-filled treatment to a clean outlined one — "quieter outlined/tertiary" per this phase's explicit preference |

View Details' new outline color (`$secondary-color`) is deliberately distinct from the Save button's neutral `$border-color` outline sitting right beside it, so the two outlined controls in the footer remain visually distinguishable from each other, not just from the two filled CTAs elsewhere on the page. Accessible contrast and the app-wide `:focus-visible` ring (`main.scss`, untouched) apply to all three buttons automatically — no change was needed there.

## 8. Responsive

- **Cards per row**: `JobCard.scss`'s existing `.jobs-list`/`.jobs-list-item` grid rules were **not touched** — re-verified by hand-calculation that they already deliver exactly the requested layout: desktop (`max-width: 1150px` container, `340px` card basis, `2.4rem` gap) fits 3 cards per row (3×340px + 2×38.4px gap = 1096.8px, within 1150px; a 4th would need 1475px); `@include laptop-down` (≤1024px) switches to `47vw` basis → 2 per row; `@include tablet-down` (≤768px) switches to `98vw` basis → 1 per row. This was already correct from Phase 2F/2G-2 and needed no change.
- **Search card overlap**: the deepened negative margin uses `{xs, sm, md}` responsive values, scaling the overlap amount down at narrow widths rather than one fixed pixel offset.
- **Hero wave**: the SVG's `height` is responsive (`{xs:34, sm:52, md:70}`) and its `width: 100%`/`preserveAspectRatio="none"` guarantee it never introduces a fixed-width overflow risk at any viewport, including 320px.
- **Navbar/hamburger**: `Navbar.jsx`/`Navbar.scss` were **not touched** this phase — the mobile hamburger mechanics, active-route pill, and desktop brand-left/nav-right layout are all untouched, re-verified by the unmodified, still-passing `testNavbar.js`/`testResponsiveNavigation.js`.

No headless-browser tool is available in this environment (the same disclosed limitation every prior phase has stated); verification combined the hand-calculated grid math above, a static audit confirming no new fixed-pixel-width pattern was introduced anywhere in this pass, and the compiled-bundle/live dev-server checks in §11.

## 9. Functionality Confirmed Untouched

Re-verified via the full, still-passing test suite (§10) rather than merely asserted: authentication (`AuthContext`, not touched), saved-job API/state logic (`useSavedJobState`, `savedJobUi.js`, not touched — only the Save button's *visible content* changed), search/filter/sort/pagination logic (`jobDiscoveryState.js`, `FindJob.jsx`, `homepageSearch.js`, `homepageJobsState.js`, none touched), Job Detail routing/state machine (`JobDetail.jsx`, `jobDetailState.js`, `App.jsx`, none touched), Apply Now behavior (untouched), every backend file, the Adzuna/RemoteOK ingestion pipeline, the API/service layer, and the database. `jobDisplay.js` was only *read*, never edited — every formatter JobCard now calls in a different order is the exact same function it called before.

## 10. Tests

No new test file was created — three existing feature-named files were updated in place to reflect the deliberately changed structure (the established "update in place" convention this project has followed every time a legitimate value/behavior change invalidated an old literal assertion):

| File | Change |
|---|---|
| `testDesignSystem.js` | Section [13] rescoped its "no flat primary.main fill" check to the hero's own sx block specifically (the new underline accent legitimately uses `primary.main` elsewhere on the page now) and its "5 stops" count to the gradient's own template string (the wave paths also legitimately read `background.sage` now); new section [13b] added for the wave SVG (full-bleed, sage-filled, no animation); section [14] updated for the deepened overlap/hero padding values; new section [14b] added for the heading's underline accent; section [15b] rewritten for View Details' new outlined treatment |
| `testJobCard.js` | Section [5] rewritten for the badge/tag area's new position (after posted date, before footer) and its conditional (not fixed-min-height) rendering; section [11]'s expected structural order updated to Company→Title→Location→Salary→Posted→Tags→Actions; section [15]'s SCSS boundary marker updated (`.job-card-header` no longer exists) |
| `testJobCardTheme.js` | Section [4] rewritten for the badge area's new position and the removed fixed-min-height rule; new sections [9]/[10] added covering the bookmark icon (imported from the existing `@mui/icons-material` dependency, toggles on the existing `isSaved` flag, inside the same button/click-handler) and the full new field order |

**Full regression: all 35 frontend deterministic test files pass, 1061/1061 checks total, 0 failures** (up from the prior correction's 1038 baseline: +23 net across the three updated files). Every other pre-existing file — `testHomepageSearch.js`, `testHomepageJobs.js`, `testHomepageContent.js`, `testJobDiscoveryUi.js`, `testJobCardMetadata.js`, `testSaveIntegration.js`, `testSavedJobUi.js`, `testJobDetails.js`/`testJobDetailStates.js`/`testJobDetailFormatters.js`/`testJobDetailDisplay.js`, `testJobApply.js`, `testNavbar.js`, `testResponsiveNavigation.js`, `testTheme.js`, and the full Phase 2B–2G7B suite — re-ran **completely unmodified** and green, confirming this phase changed nothing about save behavior, search/filter/pagination, Job Detail, or authentication.

## 11. Lint / Build / Compiled Output

- **`npm run lint`** — exit `0`, zero output, zero errors or warnings.
- **`npm run build`** — exit `0`, `1014` modules transformed (up from `1012` — exactly the 2 new `@mui/icons-material` icon imports; no other new module). CSS bundle `21.93 kB` (a small increase from the new outlined-button/tags-section rules), JS bundle `515.90 kB` / `166.71 kB` gzipped (a modest increase from the wave SVG markup, the two icon components, and the restructured JSX). The pre-existing Vite 500 kB chunk-size warning remains, unrelated to this phase.
- **Compiled output inspected directly:**

| Check | Result |
|---|---|
| Wave path data (`M0,58 C220,20...` and `M0,72 C260,110...`) present in the JS bundle | ✅ both found |
| `linear-gradient(180deg` present in the JS bundle | ✅ confirms the gradient still compiled correctly alongside the new wave |
| View Details' new outline color (`#3f8f5f`, `$secondary-color`) present in the compiled CSS | ✅ 13 occurrences (includes other pre-existing uses of the same token elsewhere) |
| Bookmark icon components bundled | Confirmed indirectly via module count (`1012` → `1014`, exactly 2 new modules) and JS bundle size growth — the literal identifier "Bookmark" isn't searchable in the minified output (icon internals are minified/tree-shaken like any other production JS), so module-count/size is the correct signal, not a string grep |
| Live dev-server check | `npm run dev` was started (frontend only — no backend behavior changed); the served `Home.jsx` module was confirmed to contain `preserveAspectRatio`/`aria-hidden` (the wave SVG); the served `JobCard.jsx` was confirmed to contain `job-tags-section` and 4 occurrences of `Bookmark`/`BookmarkBorder`. The dev server was then stopped and confirmed terminated via `tasklist`. No backend was started, so no ingestion was triggered and no production data was touched |

## 12. Files Modified

| File | Change |
|---|---|
| `frontend/src/pages/Home.jsx` | Hero gained a curved/wave SVG bottom divider (position:relative + absolute SVG, §2); search card's overlap margin deepened (§3); "Recent Jobs" heading gained a subtle underline accent (§4) |
| `frontend/src/components/JobCard/JobCard.jsx` | Full content reorder to Company→Title→Location→Salary→Posted→Tags/badges→Footer; badge/tag area now conditionally rendered (`hasTagsOrBadges`) instead of a fixed top slot; Save button gained a bookmark icon (§5/§6) |
| `frontend/src/components/JobCard/JobCard.scss` | Removed the old `.job-card-header`/fixed `min-height` badge slot; added `.job-tags-section`, moved `.job-badges`/`.job-skills` to the new position; `.view-details-btn` changed from a light-filled to an outlined treatment; `.save-btn` gained icon alignment styling (§5/§6/§7) |
| `frontend/src/tests/testDesignSystem.js` | Sections [13]/[14]/[15b] updated in place; new sections [13b]/[14b] added (§10) |
| `frontend/src/tests/testJobCard.js` | Sections [5]/[11]/[15] updated in place for the new structure (§10) |
| `frontend/src/tests/testJobCardTheme.js` | Section [4] updated in place; new sections [9]/[10] added (§10) |
| `PHASE_2G7C_REPORT.md` | This report |

**Not modified this phase:** `frontend/src/components/Navbar/Navbar.jsx`/`.scss`; `frontend/src/utils/jobDisplay.js` (only *read* — every formatter reused exactly as before); `frontend/src/utils/homepageSearch.js`, `homepageJobsState.js`, `jobDiscoveryState.js`; `frontend/src/pages/FindJob/*`; `frontend/src/pages/JobDetail/*`; `frontend/src/hooks/*` (including `useSavedJobState.js`); `frontend/src/utils/savedJobUi.js`; `frontend/src/services/*`; `frontend/src/context/AuthContext.jsx`; `frontend/src/styles/_variables.scss`, `theme.js`, `_mixins.scss`, `main.scss` (only *read* — every token this phase uses already existed); every backend file; `frontend/src/App.jsx`; every other pre-existing test file.

No file was renamed. No phase-numbered test file was created.

## 13. Known Limitations

- **No image was actually attached to this conversation** — the visual reference described in the brief (curved wave hero, premium SaaS card layout, specific field ordering) was implemented from its detailed written specification, not from pixel-inspecting an actual image.
- **No true pixel-rendered screenshot verification** — no headless-browser automation tool is available in this environment, the same limitation every prior phase has disclosed. The wave's exact curve shape, the search card's precise straddle position, and the 3/2/1 card-grid math were verified through source/structural review, hand-calculated CSS math, and compiled-bundle/live-dev-server checks (§11) rather than a rendered screenshot.
- **No numeric contrast-ratio measurement** was performed for the new outlined View Details button or the underline accent — reviewed by eye against already-established, previously-approved tokens.
- **The wave's two path shapes are fixed, hand-authored curves** (not procedurally varied) — a deliberate choice for a "premium but subtle" static shape, not a limitation of the technique; a future phase could parameterize the curve if a different silhouette is wanted.

---

*Phase 2G-7D, 2G-7E, 2G-6, 2H, and deployment work were not started. This report and the files listed in §12 are the only artifacts produced in Phase 2G-7C.*
