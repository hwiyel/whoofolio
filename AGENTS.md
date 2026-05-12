# Repository Guidelines

## Project Structure & Module Organization
This repository is currently a clean bootstrap with no application files checked in yet. Keep production code under `src/`, tests under `tests/`, and static assets under `assets/`. Reserve `scripts/` for local automation and `docs/` for design notes or operational runbooks. Example layout:

```text
src/
tests/
assets/
scripts/
docs/
```

Use feature-focused subdirectories once the codebase grows, for example `src/auth/` and `tests/auth/`.

## Build, Test, and Development Commands
There is no project manifest yet, so add commands alongside the first runtime you introduce. Standardize on a small documented command set and keep it mirrored in the root README. Recommended baseline commands:

- `make dev` or `npm run dev`: start the local development server.
- `make test` or `npm test`: run the full automated test suite.
- `make lint` or `npm run lint`: run static analysis and formatting checks.
- `make build` or `npm run build`: create a production build artifact.

If you add a different toolchain, document the exact commands here and in the project README immediately.

## Coding Style & Naming Conventions
Use 2-space indentation for frontend files (`.js`, `.ts`, `.json`, `.yml`) and 4 spaces for Python if Python is added. Prefer descriptive names: `src/user-profile/`, `tests/user_profile_test.py`, `assets/logo.svg`. Use `camelCase` for variables/functions in JavaScript or TypeScript, `PascalCase` for components/classes, and `snake_case` for Python modules. Adopt a formatter early (`prettier`, `eslint`, `ruff`, or equivalent) and run it before opening a PR.

## Testing Guidelines
Mirror the source tree in `tests/` and name test files after the unit under test, such as `tests/auth/login.test.ts` or `tests/test_login.py`. Add at least one automated test for each bug fix or user-visible feature. Aim for meaningful coverage on core paths before expanding to edge cases.

## Commit & Pull Request Guidelines
No Git history is present in this workspace, so there is no local convention to infer yet. Use short, imperative commit subjects like `Add login form validation` and keep unrelated changes in separate commits. PRs should include a brief summary, test evidence, linked issue if one exists, and screenshots for UI changes.

## Agent Working Rules
Agents and contributors should prefer caution over speed. State assumptions before coding, surface ambiguity instead of guessing, and call out simpler options when they exist. If a request is unclear or has multiple valid interpretations, stop and clarify rather than choosing silently.

Keep changes minimal and directly tied to the request. Do not add speculative features, abstractions for one-off code, or cleanup outside the touched area. Match existing style, remove only the unused code your change creates, and mention unrelated issues without fixing them unless asked.

For multi-step work, define a short plan with a verification step for each stage. Success should be testable: reproduce the bug, add or run the relevant test, implement the fix, and confirm it passes. If the solution starts feeling overbuilt, simplify it.

## Configuration & Secrets
Do not commit secrets, local `.env` files, or generated credentials. Provide safe examples in `.env.example` and document required environment variables in `README.md`.
