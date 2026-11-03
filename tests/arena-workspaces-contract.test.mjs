import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Poker calculators preserve their routes, calculations and purchases while adopting Arena", () => {
  for (const [file, path] of [
    ["icm-calculator", "/tools/calculadora-icm"],
    ["elo-simulator", "/tools/simulador-elo"],
    ["bankroll-calculator", "/tools/calculadora-banca"],
  ]) {
    const src = read("src/pages/" + file + ".tsx");
    assert.match(src, /<PageShell variant="arena">/, file);
    assert.match(src, /<ArenaToolHeader/, file);
    assert.match(src, /arena-tool-content/, file);
    assert.ok(src.includes('path="' + path + '"'), file + ": existing route");
    assert.match(src, /póker|PÓKER|poker/i, file);
  }
  assert.match(read("src/pages/icm-calculator.tsx"), /use_free_tool/);
  assert.match(read("src/pages/elo-simulator.tsx"), /use_free_tool/);
  assert.match(read("src/pages/bankroll-calculator.tsx"), /<FeaturePaywall/);
});

test("Poker profile questionnaires retain progression and show contextual heading", () => {
  const quiz = read("src/pages/poker-quiz.tsx");
  const rooms = read("src/pages/room-profiler.tsx");
  assert.match(quiz, /<ArenaToolHeader/);
  assert.match(quiz, /<PageShell variant="arena">/);
  assert.match(quiz, /useFeatureAccess\("tool_quiz"\)/);
  assert.match(quiz, /const handleFinishQuiz/);
  assert.match(quiz, /<ProgressBar/);
  assert.match(rooms, /<ArenaToolHeader/);
  assert.match(rooms, /<PageShell variant="arena">/);
  assert.match(rooms, /QUESTIONS\[currentQ\]/);
  assert.match(rooms, /orientaci[óo]n|orientativo/i);
});

test("Login and registration preserve security and registration paths", () => {
  const login = read("src/pages/login.tsx");
  const register = read("src/pages/register.tsx");
  const frame = read("src/components/arena/arena-auth-frame.tsx");
  assert.match(frame, /EL PÓKER TIENE/);
  assert.match(login, /<ArenaAuthFrame mode="login"/);
  assert.match(login, /signIn\(email, password, captchaToken\)/);
  assert.match(login, /navigate\(redirectTo\)/);
  assert.match(login, /<Turnstile/);
  assert.match(login, /autoComplete="current-password"/);
  assert.match(register, /<ArenaAuthFrame mode="register"/);
  assert.match(register, /signUp\(email, password, displayName, "player"/);
  assert.match(register, /registration_type: regType === "club"/);
  assert.match(register, /<Turnstile/);
  assert.match(register, /path="\/register"/);
  assert.match(register, /aria-describedby="register-password-hint"/);
});

test("Recovery and password reset retain auth actions but prevent indexing of private screens", () => {
  const forgot = read("src/pages/forgot-password.tsx");
  const reset = read("src/pages/update-password.tsx");
  assert.match(forgot, /resetPasswordForEmail\(email, captchaToken\)/);
  assert.match(forgot, /<ArenaAuthFrame mode="recovery"/);
  assert.match(forgot, /<Turnstile/);
  assert.match(forgot, /path="\/forgot-password" noIndex/);
  assert.match(reset, /supabase\.auth\.updateUser/);
  assert.match(reset, /navigate\("\/login"\)/);
  assert.match(reset, /<ArenaAuthFrame mode="reset"/);
  assert.match(reset, /path="\/update-password" noIndex/);
  assert.match(reset, /autoComplete="new-password"/);
});

test("Shared workspace CSS is responsive and scoped to Arena", () => {
  const css = read("src/styles/arena-workspaces.css");
  assert.match(css, /\.arena-tool-page/);
  assert.match(css, /\.arena-auth-page/);
  assert.match(css, /@media\(max-width:490px\)/);
  assert.match(read("src/components/arena/arena-tool-header.tsx"), /to="\/tools"/);
  assert.match(read("src/components/arena/arena-auth-frame.tsx"), /to="\/"/);
});
