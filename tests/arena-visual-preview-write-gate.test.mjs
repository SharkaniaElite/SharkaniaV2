import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {test} from "node:test";
const src=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
test("Preview does not authenticate or render transactional routes",()=>{
assert.match(src,/isArenaPreviewAuthBlocked\(\)/);
assert.match(src,/useAuthStore\.setState\(\{user:null/);
assert.match(src,/READ_ONLY_ARENA_PATHS/);
assert.match(src,/<PreviewReadOnlyGate>/);
assert.match(src,/Las funciones de cuenta, registro, pagos/);
assert.match(src,/!isArenaPreviewAuthBlocked\(\) && <FloatingCTA/);
});
