import assert from "node:assert/strict";import { readFileSync } from "node:fs";import { test } from "node:test";const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Educational Arena routes retain content sources and stable paths",()=>{
for(const key of ["glossary","glossary-term","elo-system","academy"]){const txt=read("src/pages/"+key+".tsx");assert.match(txt,/<PageShell variant="arena">/);assert.match(txt,/<SEOHead/);}
assert.match(read("src/pages/academy.tsx"),/useModulesWithProgress/);
assert.match(read("src/pages/glossary.tsx"),/useGlossaryTerms/);
});
