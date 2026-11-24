# Codex Cloud — SHARKANIA WEB | 24-11-2026

## Verified now
- Repository: `SharkaniaElite/SharkaniaV2`, default branch `main`; available through the ChatGPT GitHub connection with write access.
- Runtime: React, TypeScript, Vite, Node.js 22 and npm; `package-lock.json` committed.
- Cloudflare Pages and Supabase are existing production services. Connecting GitHub to ChatGPT **does not prove** a reusable Codex Cloud environment is connected/published.
- This file does **not** grant authorization to make changes in production.

## Owner-only Codex Cloud UI check
1. Open https://chatgpt.com/codex and confirm the correct workspace/account.
2. Open **Settings > Codex Cloud > Environments**. Look for a **published** environment containing exactly `SharkaniaElite/SharkaniaV2`; do not assume a generic GitHub connection means it exists.
3. If missing, select **Create environment**, choose that GitHub repo, use a private environment (**Only me**), and prepare the dependencies.
4. Ask the environment setup to use Node.js 22, `npm ci`, `node --test tests/*.test.mjs`, and `npm run build`. Review the setup report before **Publish**.
5. For the first run, provide **no Supabase or Cloudflare production credentials**. Restrict network access to necessary package-manager domains until a specific task justifies more.
6. Start one task against the published environment and ask it to list repository identity, branch SHA, instructions loaded from `AGENTS.md`, and real test outcomes. If it cannot clone/push, resolve the Codex-specific GitHub repository permissions in Codex.

Cloud documentation: https://developers.openai.com/codex/environments/cloud-environments

## First task for Codex (safe and actionable)

> Act as the Sharkania technical QA/release engineer. Read root AGENTS.md, this document and GitHub issue #98. First verify the repository and current main commit, identify existing PRs/CI, and run the project's tests and build in the isolated workspace. Produce a concise PASS/FAIL/UNKNOWN matrix with evidence. Do not add secrets, do not retrieve production player data or encrypted backups, do not deploy, migrate, merge, create paid services, or modify Supabase/Cloudflare production. Next propose the smallest independent QA work items needed to close the *existing* ELO v2 recovery gate and the unresolved Shark Coins race release gate; do not repeat completed audit phases. Implement only safe isolated test/code changes in a branch and open a PR with exact command outputs. Stop and explicitly request owner authorization for protected operations.

## Work queue and release policy
1. **Environment smoke test:** prove Codex can clone, commit to a branch, and run CI. Do not grant production credentials to satisfy this.
2. **Disaster-recovery gate:** verify a privacy-preserving, isolated restore methodology (with synthetic sample first); the real encrypted public-schema backup remains private and offline until a separate approved data-handling plan. Require full Supabase recovery scope analysis rather than treating public-only SQL as sufficient.
3. **Shark Coins:** review prior concurrency candidate and reproducible tests; do not alter production debit/credit functions without fresh preflight, rollback and owner GO.
4. **ELO v2:** follow issue #98; historical v1 ELO remains untouched, FX capture/cron and ELO v2 stay OFF until operational FX, safe restore evidence, and exact final owner GO are complete.
5. **Other UX/SEO/performance:** act only on scoped confirmed defects and avoid reopening completed investigations.

## Definition of done
- Successful isolated build/tests and verified CI for changed paths.
- Security invariants intact and regression tests meaningful.
- Focused PR with before/after evidence, rollback, no private player data, and scope limited to approved task.
- Production deployment is **not** done until separately authorized, the exact commit is deployed successfully and canonical domain smoke checks pass.
- An incomplete credential/setup/decryption prerequisite is recorded as a blocker, never papered over.

## Optional future automation
Once the owner approves a bounded release policy, a GitHub CI pipeline may auto-merge/deploy changes within that scope after required tests and safety checks. No such unattended production policy is granted by this document.
