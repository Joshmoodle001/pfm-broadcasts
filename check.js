const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", msg => console.log("LOG:", msg.text()));
  page.on("pageerror", err => console.log("ERR:", err.message));
  await page.goto("https://fmcg-merch-pwa.vercel.app#posts", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "C:\\Users\\joshm\\Desktop\\pfm-broadcasts-codex-ready\\fmcg-merch-pwa\\screenshot.png", fullPage: true });
  const html = await page.content();
  console.log("vid-card:", html.includes("vid-card"));
  console.log("img-load:", html.includes("img-load"));
  console.log("post-card count:", (html.match(/post-card/g)||[]).length);
  console.log("Screenshot saved.");
  await browser.close();
})();
