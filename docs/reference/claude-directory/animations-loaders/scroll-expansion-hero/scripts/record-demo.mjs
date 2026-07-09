/**
 * Custom demo recorder for the scroll-expansion hero.
 *
 * The shared repo recorder (scripts/record-demos/record.mjs) drives the page
 * with window.scrollTo. This hero is WHEEL-driven: it preventDefault()s native
 * scroll and snaps back to top until the media is fully expanded
 * (src/components/ui/scroll-expansion-hero.tsx), so scrollTo does nothing and
 * the recording just reveals the empty content section as a black gap.
 *
 * This recorder instead dispatches real wheel events to expand the media, holds
 * on the expanded state, scrolls through the revealed content, then collapses
 * back. Real-time capture so the framer-motion transitions and looping video
 * background are caught live.
 *
 * Prereq: project deps installed (npm install) + ffmpeg on PATH.
 * Usage:   NODE_PATH=../../scripts/record-demos/node_modules node scripts/record-demo.mjs
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const PORT = 5201;
const URL = `http://localhost:${PORT}/`;
const OUT = path.resolve("demo.mp4");
const TMP = path.join(
	process.env.TMPDIR || "/tmp",
	"scroll-expansion-demo-rec",
);
const VW = 1280;
const VH = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Dispatch a burst of wheel events to push scrollProgress toward 1 (expand) or
// 0 (collapse). deltaY * 0.0009 per event; ~1.1 total needs ~1250 of deltaY.
async function wheel(page, totalDelta, steps, perStepMs) {
	const each = totalDelta / steps;
	for (let i = 0; i < steps; i++) {
		await page.evaluate((dy) => {
			window.dispatchEvent(
				new WheelEvent("wheel", {
					deltaY: dy,
					bubbles: true,
					cancelable: true,
				}),
			);
		}, each);
		await sleep(perStepMs);
	}
}

async function waitForServer(url, attempts = 120) {
	for (let i = 0; i < attempts; i++) {
		try {
			if ((await fetch(url)).ok) return;
		} catch {
			/* not up */
		}
		await sleep(250);
	}
	throw new Error(`Dev server never came up at ${url}`);
}

const server = spawn(
	"npm",
	["run", "dev", "--", "--port", String(PORT), "--strictPort"],
	{ stdio: "ignore" },
);

try {
	await waitForServer(URL);
	rmSync(TMP, { recursive: true, force: true });
	mkdirSync(TMP, { recursive: true });

	const browser = await chromium.launch({ headless: true });
	const ctx = await browser.newContext({
		viewport: { width: VW, height: VH },
		recordVideo: { dir: TMP, size: { width: VW, height: VH } },
	});
	const page = await ctx.newPage();
	await page.goto(URL, { waitUntil: "load" });
	await page.evaluate(() => document.fonts?.ready).catch(() => {});
	await sleep(2000); // settle hero + start looping video

	// Expand the media by feeding wheel deltas (slow, so the growth reads).
	await wheel(page, 1300, 90, 45);
	await sleep(1800); // hold fully-expanded with content faded in

	// Now native scroll is unlocked — drift through the revealed content.
	await page.mouse.move(VW * 0.5, VH * 0.5);
	for (let y = 0; y <= 1400; y += 40) {
		await page.evaluate((yy) => window.scrollTo(0, yy), y);
		await sleep(28);
	}
	await sleep(1200);
	for (let y = 1400; y >= 0; y -= 60) {
		await page.evaluate((yy) => window.scrollTo(0, yy), y);
		await sleep(24);
	}
	await sleep(600);

	// Collapse back to the hero with reverse wheel.
	await wheel(page, -1300, 70, 40);
	await sleep(1200);

	await page.close();
	await ctx.close();
	await browser.close();

	const webm = readdirSync(TMP)
		.filter((f) => f.endsWith(".webm"))
		.map((f) => ({ f, t: statSync(path.join(TMP, f)).mtimeMs }))
		.sort((a, b) => b.t - a.t)[0];
	if (!webm) throw new Error("No webm produced");

	execFileSync(
		"ffmpeg",
		[
			"-y",
			"-i",
			path.join(TMP, webm.f),
			"-r",
			"30",
			"-an",
			"-c:v",
			"libx264",
			"-preset",
			"slow",
			"-pix_fmt",
			"yuv420p",
			"-crf",
			"18",
			"-movflags",
			"+faststart",
			OUT,
		],
		{ stdio: "inherit" },
	);
	rmSync(TMP, { recursive: true, force: true });
	console.log(`DONE -> ${OUT}`);
} finally {
	server.kill("SIGTERM");
}
