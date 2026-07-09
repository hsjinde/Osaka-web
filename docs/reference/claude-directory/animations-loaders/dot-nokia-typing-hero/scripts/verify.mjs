/**
 * Headless CLI verification for the dot. Nokia typing hero.
 * Drives system Chrome via puppeteer-core against the vite preview server.
 */
import puppeteer from "puppeteer-core";

const URL = process.env.VERIFY_URL ?? "http://localhost:4399/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const results = [];
const check = (name, ok, detail = "") =>
	results.push({ name, ok, detail: String(detail) });

const browser = await puppeteer.launch({
	executablePath: CHROME,
	headless: true,
	args: ["--no-sandbox", "--mute-audio"],
});

try {
	const page = await browser.newPage();
	await page.setViewport({ width: 1280, height: 900 });

	const consoleErrors = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") consoleErrors.push(msg.text());
	});
	page.on("pageerror", (err) => consoleErrors.push(err.message));

	await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });

	// 1. Headline
	const h1 = await page.$eval("h1", (el) => el.innerText);
	check(
		"Headline text",
		/Short notes\./.test(h1) && /Daily calm\./.test(h1),
		h1.replace(/\n/g, " | "),
	);
	const h1Font = await page.$eval(
		"h1",
		(el) => getComputedStyle(el).fontFamily,
	);
	check(
		"Headline uses Instrument Serif",
		h1Font.includes("Instrument Serif"),
		h1Font,
	);

	// 2. Sub-headline
	const sub = await page.evaluate(() =>
		[...document.querySelectorAll("p")].some((p) =>
			p.innerText.includes(
				"Linked with a single anonymous peer. One message every day. A quiet rhythm in the digital noise.",
			),
		),
	);
	check("Sub-headline text", sub);

	// 3. Navbar
	const logoFont = await page.evaluate(() => {
		const el = [...document.querySelectorAll("nav a")].find(
			(a) => a.innerText.trim() === "dot.",
		);
		return el ? getComputedStyle(el).fontFamily : null;
	});
	check(
		"Logo 'dot.' present in Instrument Serif",
		Boolean(logoFont?.includes("Instrument Serif")),
		logoFont,
	);
	const links = await page.evaluate(() =>
		["Philosophy", "Trust", "Access", "Tribe"].every((t) =>
			[...document.querySelectorAll("nav a")].some(
				(a) => a.innerText.trim() === t,
			),
		),
	);
	check("Nav links Philosophy/Trust/Access/Tribe", links);
	const navFixed = await page.evaluate(() => {
		const header = document.querySelector("header");
		const s = getComputedStyle(header);
		return { position: s.position, zIndex: s.zIndex, top: s.top };
	});
	check(
		"Navbar fixed at top with z-50",
		navFixed.position === "fixed" && navFixed.zIndex === "50",
		JSON.stringify(navFixed),
	);
	const cta = await page.evaluate(() => {
		const el = [...document.querySelectorAll("nav a")].find((a) =>
			a.innerText.includes("Link up"),
		);
		if (!el) return null;
		const s = getComputedStyle(el);
		return {
			bg: s.backgroundColor,
			radius: s.borderRadius,
			hasGlint: Boolean(el.querySelector("span")),
			boxShadow: s.boxShadow,
		};
	});
	check(
		"CTA 'Link up' blue pill with inset shadow + glint",
		Boolean(
			cta &&
				cta.bg === "rgb(8, 113, 231)" &&
				cta.hasGlint &&
				cta.boxShadow.includes("inset"),
		),
		JSON.stringify(cta),
	);

	// 4. Hero video
	const video = await page.evaluate(() => {
		const v = document.querySelector("video");
		if (!v) return null;
		return {
			src: v.getAttribute("src"),
			autoplay: v.autoplay,
			loop: v.loop,
			muted: v.muted,
			playsInline: v.playsInline,
			objectFit: getComputedStyle(v).objectFit,
			readyState: v.readyState,
			paused: v.paused,
		};
	});
	check(
		"Video element configured (autoplay/loop/muted/playsinline/object-cover)",
		Boolean(
			video?.autoplay &&
				video.loop &&
				video.muted &&
				video.playsInline &&
				video.objectFit === "cover",
		),
		JSON.stringify({ ...video, src: undefined }),
	);
	check(
		"Video src exact",
		video?.src ===
			"https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260427_054418_a6d194f0-ac86-4df9-abe5-ded73e596d7c.mp4",
		video?.src,
	);
	check(
		"Video is playing",
		Boolean(video && video.readyState >= 2 && !video.paused),
		`readyState=${video?.readyState} paused=${video?.paused}`,
	);

	// 5. Typing messages — observe the cycle live
	const nokiaFont = await page.evaluate(() => {
		const p = [...document.querySelectorAll("p")].find((el) =>
			getComputedStyle(el).fontFamily.includes("Nokia"),
		);
		return p ? getComputedStyle(p).fontFamily : null;
	});
	check(
		"Nokia font applied to typing text",
		Boolean(nokiaFont?.includes("Nokia Cellphone FC Small")),
		nokiaFont,
	);

	const samples = new Set();
	for (let i = 0; i < 24; i++) {
		const t = await page.evaluate(() => {
			const p = [...document.querySelectorAll("p")].find((el) =>
				getComputedStyle(el).fontFamily.includes("Nokia"),
			);
			return p ? p.textContent.trim() : "";
		});
		if (t) samples.add(t);
		await new Promise((r) => setTimeout(r, 350));
	}
	const sampleArr = [...samples];
	const sawTyping = sampleArr.some(
		(t) =>
			t !== "Are you here?" && "Are you here?".startsWith(t) && t.length > 0,
	);
	const sawFull = sampleArr.includes("Are you here?");
	check(
		"Typing animation progresses character by character",
		sawTyping && sawFull,
		`samples: ${sampleArr.slice(0, 12).join(" / ")}`,
	);

	// 6. Nokia webfont stylesheet reachable
	const nokiaCss = await page.evaluate(async () => {
		const res = await fetch(
			"https://db.onlinewebfonts.com/c/440b53b1a1c65037f944ff19259d8014?family=Nokia+Cellphone+FC+Small",
		);
		return { ok: res.ok, status: res.status };
	});
	check("Nokia webfont CSS loads", nokiaCss.ok, `status=${nokiaCss.status}`);

	// 7. Console errors
	check(
		"No console/page errors",
		consoleErrors.length === 0,
		consoleErrors.join("; ").slice(0, 300),
	);
} finally {
	await browser.close();
}

let failed = 0;
for (const r of results) {
	const mark = r.ok ? "PASS" : "FAIL";
	if (!r.ok) failed++;
	console.log(`[${mark}] ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
