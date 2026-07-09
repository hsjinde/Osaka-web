/* Headless CLI verification for the QClay hexagon loader.
 * Boots `vite preview` (or reuses a running server) and drives a headless
 * Chromium through the loader, asserting structure, layering, assets, mask,
 * breathing motion, icon swapping, the loading label and the uneven progress
 * bar — all without a GUI.
 *
 * Usage: node scripts/verify.mjs [baseURL]   (default http://localhost:4173)
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

const BASE_URL = process.argv[2] ?? "http://localhost:4173";

let failures = 0;
const check = (name, ok, detail = "") => {
	console.log(
		`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`,
	);
	if (!ok) failures += 1;
};
const approx = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;

// ── Boot a preview server unless one is already up at BASE_URL ─────────────
let server = null;
async function ensureServer() {
	try {
		const res = await fetch(BASE_URL);
		if (res.ok) return; // already serving
	} catch {
		/* not up — start one */
	}
	server = spawn(
		"npm",
		["run", "preview", "--", "--port", "4173", "--strictPort"],
		{ stdio: "ignore", env: process.env },
	);
	for (let i = 0; i < 60; i++) {
		try {
			const res = await fetch(BASE_URL);
			if (res.ok) return;
		} catch {
			/* keep waiting */
		}
		await sleep(500);
	}
	throw new Error("preview server never came up");
}

function stopServer() {
	if (server) {
		server.kill("SIGTERM");
		server = null;
	}
}

try {
	await ensureServer();

	const browser = await chromium.launch();
	const page = await browser.newPage({
		viewport: { width: 1440, height: 900 },
	});

	const consoleErrors = [];
	page.on(
		"console",
		(msg) => msg.type() === "error" && consoleErrors.push(msg.text()),
	);
	page.on("pageerror", (err) => consoleErrors.push(String(err)));
	// Track any failed network requests (e.g. a missing local asset).
	const failedRequests = [];
	page.on("requestfailed", (req) =>
		failedRequests.push(`${req.url()} (${req.failure()?.errorText})`),
	);
	const notFound = [];
	page.on("response", (res) => {
		if (res.status() >= 400) notFound.push(`${res.url()} -> ${res.status()}`);
	});

	await page.goto(BASE_URL, { waitUntil: "networkidle" });
	await page.waitForTimeout(1200); // let the initial icon layer settle

	// ── Page meta ────────────────────────────────────────────────────────────
	check(
		"page title",
		(await page.title()) === "Loading Resources",
		await page.title(),
	);

	// ── Root background + layout ───────────────────────────────────────────────
	const rootStyle = await page.locator("main.loader-root").evaluate((el) => {
		const cs = getComputedStyle(el);
		return {
			display: cs.display,
			alignItems: cs.alignItems,
			justifyContent: cs.justifyContent,
			overflow: cs.overflow,
			position: cs.position,
			minHeight: cs.minHeight,
			background: cs.backgroundImage,
		};
	});
	check("root display flex", rootStyle.display === "flex");
	check("root align-items center", rootStyle.alignItems === "center");
	check("root justify-content center", rootStyle.justifyContent === "center");
	check("root overflow hidden", rootStyle.overflow === "hidden");
	check("root position relative", rootStyle.position === "relative");
	check(
		"root radial gradient bg",
		rootStyle.background.includes("radial-gradient"),
		rootStyle.background.slice(0, 60),
	);

	// No scrollbars: document should not be scrollable.
	const scroll = await page.evaluate(() => ({
		sw: document.documentElement.scrollWidth,
		cw: document.documentElement.clientWidth,
		sh: document.documentElement.scrollHeight,
		ch: document.documentElement.clientHeight,
	}));
	check(
		"no horizontal scroll",
		scroll.sw <= scroll.cw + 1,
		`${scroll.sw} vs ${scroll.cw}`,
	);
	check(
		"no vertical scroll",
		scroll.sh <= scroll.ch + 1,
		`${scroll.sh} vs ${scroll.ch}`,
	);

	// ── Scene container + mask ────────────────────────────────────────────────
	const scene = page.locator(".hex-scene-mask");
	check("scene container exists", (await scene.count()) === 1);
	const sceneBox = await scene.evaluate((el) => {
		const cs = getComputedStyle(el);
		return {
			width: parseFloat(cs.width),
			height: parseFloat(cs.height),
			mask: cs.maskImage || cs.webkitMaskImage,
			position: cs.position,
		};
	});
	check(
		"scene width 1184px",
		approx(sceneBox.width, 1184, 1),
		`${sceneBox.width}`,
	);
	check(
		"scene height 799.5px",
		approx(sceneBox.height, 799.5, 1),
		`${sceneBox.height}`,
	);
	check("scene position relative", sceneBox.position === "relative");
	check(
		"scene radial mask applied",
		/radial-gradient/.test(sceneBox.mask),
		(sceneBox.mask || "").slice(0, 50),
	);

	// ── Polygon tile count + variants ─────────────────────────────────────────
	const polyInfo = await page.evaluate(() => {
		const imgs = [...document.querySelectorAll(".hex-scene-mask img")].filter(
			(i) => i.src.includes("/polygons/"),
		);
		const counts = { s: 0, c: 0, m: 0 };
		for (const i of imgs) {
			if (i.src.includes("s-polygon")) counts.s++;
			else if (i.src.includes("c-polygon")) counts.c++;
			else if (i.src.includes("m-polygon")) counts.m++;
		}
		return { total: imgs.length, counts };
	});
	// 16 outer s + (row1: 2 s + 2 c) + (row2: 2 s + 2 c + 1 m) + (row3: 2 s + 2 c)
	// = s: 16+2+2+2 = 22, c: 2+2+2 = 6, m: 1  →  29 total
	check("29 polygon tiles", polyInfo.total === 29, `${polyInfo.total}`);
	check("22 s-polygons", polyInfo.counts.s === 22, `${polyInfo.counts.s}`);
	check("6 c-polygons", polyInfo.counts.c === 6, `${polyInfo.counts.c}`);
	check(
		"1 m-polygon (center)",
		polyInfo.counts.m === 1,
		`${polyInfo.counts.m}`,
	);

	// ── Center glow ────────────────────────────────────────────────────────────
	const glow = await page.locator(".hex-glow").evaluate((el) => {
		const cs = getComputedStyle(el);
		return {
			w: parseFloat(cs.width),
			h: parseFloat(cs.height),
			radius: cs.borderRadius,
			filter: cs.filter,
			z: cs.zIndex,
			bg: cs.backgroundColor,
		};
	});
	check(
		"glow 120x120",
		glow.w === 120 && glow.h === 120,
		`${glow.w}x${glow.h}`,
	);
	check("glow circular", glow.radius === "50%", glow.radius);
	check("glow blur(37px)", glow.filter.includes("blur(37px)"), glow.filter);
	check("glow z-index 3", glow.z === "3", glow.z);
	check("glow blue rgba", glow.bg.includes("71, 112, 189"), glow.bg);

	// ── Icons: exactly 3 settled slots, distinct, correct sets ────────────────
	const iconInfo = await page.evaluate(() => {
		const icons = [...document.querySelectorAll("img.hex-icon")];
		const settled = icons.filter(
			(i) =>
				!i.className.includes("hex-icon-in") &&
				!i.className.includes("hex-icon-out"),
		);
		const slots = icons.map((i) => i.getAttribute("src"));
		return {
			rendered: icons.length,
			settled: settled.length,
			srcs: slots,
		};
	});
	check(
		"3 settled icons (one per slot)",
		iconInfo.settled === 3,
		`${iconInfo.settled}`,
	);
	// Center (middle) slot uses white icons, the two side slots use dark icons.
	const whiteCount = iconInfo.srcs.filter((s) => s?.includes("icon-w-")).length;
	const darkCount = iconInfo.srcs.filter(
		(s) => s && /icon-\d/.test(s) && !s.includes("icon-w-"),
	).length;
	check("middle slot uses white icon", whiteCount >= 1, `${whiteCount}`);
	check("side slots use dark icons", darkCount >= 2, `${darkCount}`);
	// Distinct triplet
	const distinctIdx = new Set(
		iconInfo.srcs.map((s) => (s || "").match(/icon-(?:w-)?(\d\d)\.svg/)?.[1]),
	);
	check(
		"triplet icons distinct",
		distinctIdx.size === 3,
		[...distinctIdx].join(","),
	);

	// All icons must be 32x32 and centered (transform contains translate(-50%, -50%))
	const iconBox = await page
		.locator("img.hex-icon")
		.first()
		.evaluate((el) => {
			const cs = getComputedStyle(el);
			return {
				w: parseFloat(cs.width),
				h: parseFloat(cs.height),
				pe: cs.pointerEvents,
			};
		});
	check(
		"icon size 32x32",
		iconBox.w === 32 && iconBox.h === 32,
		`${iconBox.w}x${iconBox.h}`,
	);
	check("icon pointer-events none", iconBox.pe === "none", iconBox.pe);

	// ── Loading label ─────────────────────────────────────────────────────────
	const label = page.locator(".loading-text");
	// Raw DOM text is "Loading Resources"; CSS text-transform renders it uppercase.
	const labelText = await label.evaluate((el) => el.textContent);
	check("loading text content", labelText === "Loading Resources", labelText);
	const labelStyle = await label.evaluate((el) => {
		const cs = getComputedStyle(el);
		return {
			size: cs.fontSize,
			weight: cs.fontWeight,
			transform: cs.textTransform,
			clip: cs.webkitBackgroundClip || cs.backgroundClip,
			anim: cs.animationName,
		};
	});
	check("label 12px", labelStyle.size === "12px", labelStyle.size);
	check("label weight 500", labelStyle.weight === "500", labelStyle.weight);
	check(
		"label uppercase",
		labelStyle.transform === "uppercase",
		labelStyle.transform,
	);
	check(
		"label background-clip text",
		labelStyle.clip === "text",
		labelStyle.clip,
	);
	check(
		"label shimmer animation",
		labelStyle.anim.includes("loadingShimmer"),
		labelStyle.anim,
	);

	// ── Progress bar: present, fills over time, behaves unevenly ──────────────
	const track = page.locator(".progress-track");
	const fill = page.locator(".progress-fill");
	check("progress track exists", (await track.count()) === 1);
	const trackStyle = await track.evaluate((el) => {
		const cs = getComputedStyle(el);
		return { h: cs.height, overflow: cs.overflow };
	});
	check("track 3px tall", trackStyle.h === "3px", trackStyle.h);
	check(
		"track overflow hidden",
		trackStyle.overflow === "hidden",
		trackStyle.overflow,
	);

	const widthAt = async () =>
		fill.evaluate((el) => parseFloat(getComputedStyle(el).width));
	const trackWidth = await track.evaluate((el) =>
		parseFloat(getComputedStyle(el).width),
	);
	const w1 = await widthAt();
	await page.waitForTimeout(2500);
	const w2 = await widthAt();
	check(
		"progress advances over time",
		w2 > w1 || w2 < w1 + trackWidth,
		`${w1.toFixed(0)} -> ${w2.toFixed(0)} of ${trackWidth.toFixed(0)}`,
	);
	check(
		"progress fill is bounded",
		w2 <= trackWidth + 1,
		`${w2.toFixed(0)} <= ${trackWidth.toFixed(0)}`,
	);

	// ── Breathing motion: the m-polygon image scale changes over a frame gap ──
	const mScaleAt = () =>
		page.evaluate(() => {
			const m = [...document.querySelectorAll(".hex-scene-mask img")].find(
				(i) => i.src.includes("m-polygon"),
			);
			return getComputedStyle(m).transform;
		});
	const s1 = await mScaleAt();
	await page.waitForTimeout(500);
	const s2 = await mScaleAt();
	check(
		"breathing animates m-polygon",
		s1 !== s2,
		`${s1.slice(0, 24)} -> ${s2.slice(0, 24)}`,
	);

	// ── Icon swap actually happens within one full cycle (~2.5s) ──────────────
	const tripletNow = await page.evaluate(() =>
		[...document.querySelectorAll("img.hex-icon")]
			.map(
				(i) => (i.getAttribute("src") || "").match(/icon-(?:w-)?(\d\d)/)?.[1],
			)
			.filter(Boolean)
			.sort()
			.join(","),
	);
	let swapped = false;
	for (let i = 0; i < 16; i++) {
		await page.waitForTimeout(300);
		const t = await page.evaluate(() =>
			[...document.querySelectorAll("img.hex-icon")]
				.map(
					(i) => (i.getAttribute("src") || "").match(/icon-(?:w-)?(\d\d)/)?.[1],
				)
				.filter(Boolean)
				.sort()
				.join(","),
		);
		if (t !== tripletNow) {
			swapped = true;
			break;
		}
	}
	check(
		"icons swap to a new triplet within a cycle",
		swapped,
		`from ${tripletNow}`,
	);

	// ── No errors / no missing assets ─────────────────────────────────────────
	check(
		"no failed requests",
		failedRequests.length === 0,
		failedRequests.join(" | ").slice(0, 200),
	);
	check(
		"no 4xx/5xx responses",
		notFound.length === 0,
		notFound.join(" | ").slice(0, 200),
	);
	check(
		"no console/page errors",
		consoleErrors.length === 0,
		consoleErrors.join(" | ").slice(0, 200),
	);

	await browser.close();

	console.log(
		failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`,
	);
} finally {
	stopServer();
}

process.exit(failures === 0 ? 0 : 1);
