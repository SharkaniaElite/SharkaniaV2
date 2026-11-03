import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const ignition = read("src/pages/ignition-championship.tsx");
const app = read("src/App.tsx");
const preview = read("src/lib/arena-preview.ts");
const upload = read("src/components/admin/results-upload.tsx");
const editor = read("src/components/admin/results-editor.tsx");
const engine = read("src/lib/api/elo-engine.ts");

test("Ignition cannot sign in/register against production on a blocked Arena Preview", () => {
  assert.match(ignition, /import \{ isArenaPreviewAuthBlocked \}/);
  assert.match(ignition, /const previewBlocked = isArenaPreviewAuthBlocked\(\)/);
  assert.match(ignition, /const handleSubmit = async[^]*?e\.preventDefault\(\);\s*\/\/[^\n]*\n\s*if \(previewBlocked\) return;/);
  assert.match(ignition, /previewBlocked \? \([\s\S]*?Formulario deshabilitado en esta vista previa/);
  assert.match(preview, /actualRef !== "nhpjzywfzljtlqaigzed"/);
  assert.match(preview, /VITE_ARENA_ALLOW_PREVIEW_AUTH !== "true"/);
});

test("Production Auth session initialization is disabled on a blocked public preview", () => {
  assert.match(app, /if \(isArenaPreviewAuthBlocked\(\)\) \{/);
  assert.match(app, /user: null,[\s\S]*?profile: null,[\s\S]*?isAuthenticated: false/);
  assert.match(app, /return;\s*}\s*if \(!initialized\)/);
});

test("Legacy admin upload/edit cannot write results before guarded RPC is ready", () => {
  assert.match(upload, /const handleResolveAndUpload = async \(\) => \{\s*\/\/[^]*?if \(GUARDED_ELO_RPC_ENABLED\) \{/);
  assert.match(editor, /const handleSave = async \(\) => \{\s*\/\/[^]*?if \(GUARDED_ELO_RPC_ENABLED\) \{/);
  assert.ok(upload.indexOf("if (GUARDED_ELO_RPC_ENABLED)") < upload.indexOf("const resolvedRows: ResultRow[]"));
  assert.ok(editor.indexOf("if (GUARDED_ELO_RPC_ENABLED)") < editor.indexOf("await prepareTournamentForReedit("));
  assert.match(engine, /if \(GUARDED_ELO_RPC_ENABLED\) return calculateEloThroughGuardedRpc\(tournamentId\)/);
});

test.todo("Isolated Supabase QA E2E: verified and unverified Ignition registration/login");
test.todo("Replace legacy admin results upload/edit with authenticated atomic database operations");
