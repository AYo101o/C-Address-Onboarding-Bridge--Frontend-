# docs: Add CONTRIBUTING.md, issue templates, and PR template

## Summary

This PR adds two sets of documentation improvements to the repository:

1. **CONTRIBUTING.md** — A contributing guide that covers prerequisites, setup, local verification steps matching CI exactly, branch naming conventions, commit conventions, and PR expectations.
2. **GitHub issue and pull request templates** — Bug report and feature request issue templates that mirror the wave's structured format, and a PR template with a checklist for linked issues, testing confirmation, and UI screenshots.

---

## Changes

### Issue #250 — CONTRIBUTING.md

- Added `CONTRIBUTING.md` at the repository root.
- Covers prerequisites: Node.js 22 and npm (matching the CI configuration in `.github/workflows/ci.yml`).
- Includes setup instructions: `npm ci`, environment configuration via `.env.example`, and running the dev server.
- Documents the four CI checks and their local equivalents:
  - `npm run lint` — ESLint for code style and error detection
  - `npm run typecheck` — TypeScript type checking with `tsc --noEmit`
  - `npm run test` — Vitest test suite
  - `npm run build` — Production build with bundle budget enforcement
- Specifies branch naming conventions (e.g., `feat/250-add-contributing-md`).
- Specifies commit conventions using conventional commit format.
- Defines PR expectations: one issue per PR, regression tests for bug fixes, all CI checks passing locally before pushing, and linking the issue in the PR description.
- Points to `.github/workflows/ci.yml` as the source of truth for required checks.
- Linked from the README.md under a new "Contributing" section.

### Issue #251 — GitHub issue and pull request templates

- Added `.github/ISSUE_TEMPLATE/bug_report.md`:
  - Mirrors the wave's issue structure with Problem, Why it matters, Suggested Fix, and Definition of Done sections.
  - Definition of Done includes a checklist for bug fix, regression test, CI checks, and issue linking.
- Added `.github/ISSUE_TEMPLATE/feature_request.md`:
  - Same structure as the bug report template, tailored for feature requests.
  - Definition of Done includes a checklist for implementation, tests, CI checks, and issue linking.
- Added `.github/PULL_REQUEST_TEMPLATE.md`:
  - Includes a Summary section, Linked Issue reference, Changes list, Testing checklist (lint, typecheck, test, build), and a Screenshots section for UI changes.

---

## Definition of Done

- [x] CONTRIBUTING.md exists and is linked from the README
- [x] CONTRIBUTING.md covers setup, local verification steps matching CI exactly, and PR expectations
- [x] Both issue templates and the PR template exist and render correctly when opening a new issue/PR on GitHub
- [x] Templates match the level of detail used across this wave's issues

---

## Files changed

```
CONTRIBUTING.md
.github/ISSUE_TEMPLATE/bug_report.md
.github/ISSUE_TEMPLATE/feature_request.md
.github/PULL_REQUEST_TEMPLATE.md
README.md
```

---

Closes #250
Closes #251