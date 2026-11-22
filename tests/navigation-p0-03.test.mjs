import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CONTACT_EMAIL,
  NAVIGATION,
  isNavigationGroupActive,
  isNavigationLinkActive,
  pathMatches,
} from "../src/components/layout/navigation.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const navbar = read("src/components/layout/navbar.tsx");
const app = read("src/App.tsx");

test("both responsive layouts render the same ordered sections and destinations", () => {
  assert.deepEqual(NAVIGATION.map(({ label }) => label), [
    "Aprende", "SharkTV", "Herramientas", "Arena", "Noticias", "Más",
  ]);
  assert.deepEqual(NAVIGATION[0].links.map(({ href }) => href), ["/academia", "/blog", "/glosario"]);
  assert.equal(NAVIGATION[1].href, "/tv");
  assert.equal(NAVIGATION[2].href, "/tools");
  assert.deepEqual(NAVIGATION[3].links.map(({ href }) => href), ["/ranking", "/calendar", "/leagues", "/clubs", "/sistema-elo"]);
  assert.equal(NAVIGATION[4].href, "/noticias");
  assert.match(navbar, /NAVIGATION\.map/);
  assert.equal((navbar.match(/NAVIGATION\.map/g) ?? []).length, 1);
  assert.match(navbar, /<NavigationSections [^>]*arena=\{arena\} \/>/);
  assert.match(navbar, /<NavigationSections [^>]* mobile arena=\{arena\}/);
});

test("links and groups distinguish descendants from routes with similar names", () => {
  const [learn, tv, tools, arena, news] = NAVIGATION;
  for (const route of ["/ranking", "/ranking/jugador", "/calendar", "/tournament/42", "/clubs/club"]) {
    assert.ok(isNavigationGroupActive(route, arena), route);
  }
  assert.ok(isNavigationGroupActive("/academia/modulo/leccion", learn));
  assert.ok(isNavigationGroupActive("/blog/estrategia", learn));
  assert.ok(isNavigationLinkActive("/tv/hand-1", tv));
  assert.ok(isNavigationLinkActive("/tools/arbol-de-decisiones", tools));
  assert.ok(isNavigationLinkActive("/noticias/articulo", news));
  assert.ok(pathMatches("/TV/", "/tv"));
  for (const [path, href] of [
    ["/ranking-extra", "/ranking"], ["/academiamos", "/academia"],
    ["/tv-online/1", "/tv"], ["/toolset", "/tools"], ["/administrator", "/admin"],
  ]) {
    assert.ok(!pathMatches(path, href), path);
  }
});

test("commercial navigation has one secondary entry and keeps legacy destinations routable", () => {
  const more = NAVIGATION.at(-1);
  assert.deepEqual(more.links.map(({ href }) => href), ["/shop", "/compare"]);
  assert.equal(more.support, true);
  assert.equal(CONTACT_EMAIL, "mailto:contacto@sharkania.com");
  assert.deepEqual(NAVIGATION.flatMap((item) => item.commercialLinks ?? []), [
    { label: "Promociones", href: "/promociones" },
  ]);
  assert.doesNotMatch(navbar, /Salas Recomendadas|CoinPoker|Ignition|animate-ping/);
  const configuredPaths = NAVIGATION.flatMap((item) => "href" in item
    ? [item.href]
    : [...item.links, ...item.commercialLinks ?? []].map(({ href }) => href));
  for (const path of [
    ...configuredPaths, "/live", "/tv/:id", "/login", "/register", "/dashboard", "/admin/club", "/admin",
    "/promociones/coinpoker", "/ignition", "/tutorial-coinpoker", "/tutorial-ignition",
  ]) {
    assert.ok(app.includes(`path="${path}"`), path);
  }
});

test("account actions use the existing authentication state and protected routes", () => {
  assert.match(navbar, /!isLoading && isAuthenticated && profile/);
  assert.match(navbar, /profile\?\.role === "super_admin"/);
  assert.match(navbar, /const isAdmin = isSuperAdmin \|\| profile\?\.role === "club_admin"/);
  assert.match(navbar, /isAdmin && \(\s*<Link to="\/admin\/club"/);
  assert.match(navbar, /isSuperAdmin && \(\s*<Link to="\/admin"/);
  assert.match(navbar, /await logout\(\)/);
  assert.match(app, /path="\/admin"\s+element=\{\s*<ProtectedRoute requiredRole=\{\["super_admin"\]\}/);
  assert.match(app, /path="\/admin\/club"\s+element=\{\s*<ProtectedRoute requiredRole=\{\["club_admin", "super_admin"\]\}/);
});

test("preview keeps private routes blocked even when the menu advertises their destinations", () => {
  const allowlist = app.match(/const READ_ONLY_ARENA_PATHS = \[([\s\S]*?)\];/)[1];
  const patterns = [...allowlist.matchAll(/\/(\^.*?\$)\//g)].map(([, pattern]) => new RegExp(pattern));
  assert.ok(patterns.length > 0);
  for (const path of ["/tv", "/academia/modulo", "/login", "/register", "/dashboard", "/admin", "/admin/club"]) {
    assert.ok(!patterns.some((pattern) => pattern.test(path)), path);
  }
  for (const path of ["/academia", "/tools", "/ranking", "/noticias", "/promociones"]) {
    assert.ok(patterns.some((pattern) => pattern.test(path)), path);
  }
  assert.match(app, /<PreviewReadOnlyGate>\s*<Routes>/);
  assert.match(app, /if \(isArenaPreviewAuthBlocked\(\)\) \{\s*useAuthStore\.setState\(\{user:null,profile:null,isAuthenticated:false/);
});
