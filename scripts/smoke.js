const path = require("path");
const { chromium } = require("/Users/avishekchakraborty/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";
const screenshotDir = process.env.SCREENSHOT_DIR || "/private/tmp";

async function checkViewport(name, viewport) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".lobby-hero").waitFor({ state: "visible" });
  const h1 = await page.locator("h1").first().innerText();
  const hero = await page.locator(".lobby-hero").boundingBox();
  const screenshot = path.join(screenshotDir, `warland-${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await browser.close();
  return { name, h1, hero, errors, screenshot };
}

async function api(pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
}

async function makeGameRoom() {
  const room = await api("/api/rooms", { name: "Smoke Table", maxPlayers: 4 });
  const host = await api(`/api/rooms/${room.id}/join`, { name: "Host" });
  await api(`/api/rooms/${room.id}/join`, { name: "Guest" });
  await api(`/api/rooms/${room.id}/start`, { playerId: host.playerId });
  return room.id;
}

async function checkGame(roomId, name = "game", viewport = { width: 1440, height: 1000 }) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${baseUrl}/?room=${roomId}`, { waitUntil: "domcontentloaded" });
  await page.locator(".board").waitFor({ state: "visible" });
  const tileCount = await page.locator(".tile").count();
  const playerCount = await page.locator(".player-row").count();
  const priceCount = await page.locator(".tile-price").count();
  const diceCount = await page.locator(".board-die").count();
  const screenshot = path.join(screenshotDir, `warland-${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await browser.close();
  return { name, tileCount, playerCount, priceCount, diceCount, errors, screenshot };
}

async function checkDarkGame(roomId) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${baseUrl}/?room=${roomId}`, { waitUntil: "domcontentloaded" });
  await page.locator(".board").waitFor({ state: "visible" });
  await page.locator("#themeToggle").click();
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  const brand = await page.locator(".brand span").innerText();
  const screenshot = path.join(screenshotDir, "warland-game-dark.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await browser.close();
  return { name: "game-dark", theme, brand, errors, screenshot };
}

(async () => {
  const results = [];
  results.push(await checkViewport("desktop", { width: 1440, height: 1000 }));
  results.push(await checkViewport("mobile", { width: 390, height: 844 }));
  const gameRoomId = await makeGameRoom();
  results.push(await checkGame(gameRoomId));
  results.push(await checkGame(gameRoomId, "game-mobile", { width: 390, height: 844 }));
  results.push(await checkDarkGame(gameRoomId));
  const failures = results.flatMap((result) => result.errors.map((error) => `${result.name}: ${error}`));
  if (results.some((result) => result.tileCount !== undefined && result.tileCount !== 40)) failures.push("game: expected 40 board tiles");
  if (results.some((result) => result.priceCount !== undefined && result.priceCount < 28)) failures.push("game: expected visible prices for board assets");
  if (results.some((result) => result.diceCount !== undefined && result.diceCount !== 2)) failures.push("game: expected two board dice");
  if (results.some((result) => result.name === "game-dark" && result.theme !== "dark")) failures.push("game-dark: expected dark theme");
  if (results.some((result) => result.brand !== undefined && result.brand !== "WarLand")) failures.push("game-dark: expected WarLand brand");
  console.log(JSON.stringify({ results, failures }, null, 2));
  process.exit(failures.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
