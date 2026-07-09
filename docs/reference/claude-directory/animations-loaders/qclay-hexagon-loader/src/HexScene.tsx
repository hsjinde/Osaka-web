import { memo, useEffect, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
   QClay hexagon loader scene.

   Faithful implementation of the supplied spec. Icons are vendored locally
   under `public/loader/` (served at `/loader/...`) so the loader runs fully
   offline; the three polygon SVGs live under `public/polygons/`.

   `HexScene` renders the radially-masked polygon cluster. The loading label +
   progress bar are rendered separately by `LoadingBlock` so they sit *outside*
   the mask (over the background), exactly as the spec requires.
   ────────────────────────────────────────────────────────────────────────── */

const ICON_INDEXES = [
	"01",
	"02",
	"03",
	"04",
	"05",
	"06",
	"07",
	"08",
	"09",
	"10",
	"11",
];
const darkSrc = (n: string) => `/loader/icon-${n}.svg`;
const whiteSrc = (n: string) => `/loader/icon-w-${n}.svg`;

const M_POLY = "/polygons/m-polygon.svg";
const S_POLY = "/polygons/s-polygon.svg";
const C_POLY = "/polygons/c-polygon.svg";

const HEX_W = 141;
const HEX_H = 155;
const GAP = 8;
const STEP_X = HEX_W + GAP; // 149
const STEP_Y = HEX_H * 0.78 + GAP; // 128.9

type Variant = "s" | "c" | "m";
type Hex = {
	x: number;
	y: number;
	variant: Variant;
	z: number;
	iconSet?: "dark" | "white";
	slot?: number;
};

type IconLayerStatus = "current" | "incoming" | "outgoing";
type IconLayer = { id: number; icons: string[]; status: IconLayerStatus };

const HEXES: Hex[] = [
	// Outer ring — all s-polygon, z-index 0
	{ x: -2 * STEP_X, y: -2 * STEP_Y, variant: "s", z: 0 },
	{ x: -1 * STEP_X, y: -2 * STEP_Y, variant: "s", z: 0 },
	{ x: 0, y: -2 * STEP_Y, variant: "s", z: 0 },
	{ x: 1 * STEP_X, y: -2 * STEP_Y, variant: "s", z: 0 },
	{ x: 2 * STEP_X, y: -2 * STEP_Y, variant: "s", z: 0 },
	{ x: -2.5 * STEP_X, y: -STEP_Y, variant: "s", z: 0 },
	{ x: 2.5 * STEP_X, y: -STEP_Y, variant: "s", z: 0 },
	{ x: -3 * STEP_X, y: 0, variant: "s", z: 0 },
	{ x: 3 * STEP_X, y: 0, variant: "s", z: 0 },
	{ x: -2.5 * STEP_X, y: STEP_Y, variant: "s", z: 0 },
	{ x: 2.5 * STEP_X, y: STEP_Y, variant: "s", z: 0 },
	{ x: -2 * STEP_X, y: 2 * STEP_Y, variant: "s", z: 0 },
	{ x: -1 * STEP_X, y: 2 * STEP_Y, variant: "s", z: 0 },
	{ x: 0, y: 2 * STEP_Y, variant: "s", z: 0 },
	{ x: 1 * STEP_X, y: 2 * STEP_Y, variant: "s", z: 0 },
	{ x: 2 * STEP_X, y: 2 * STEP_Y, variant: "s", z: 0 },

	// Main row 1 (top), y = -STEP_Y
	{ x: -1.5 * STEP_X, y: -STEP_Y, variant: "s", z: 1 },
	{ x: -0.5 * STEP_X, y: -STEP_Y, variant: "c", z: 2 },
	{ x: 0.5 * STEP_X, y: -STEP_Y, variant: "c", z: 2 },
	{ x: 1.5 * STEP_X, y: -STEP_Y, variant: "s", z: 1 },

	// Main row 2 (center), y = 0
	{ x: -2 * STEP_X, y: 0, variant: "s", z: 1 },
	{ x: -1 * STEP_X, y: 0, variant: "c", z: 4, iconSet: "dark", slot: 0 },
	{ x: 0, y: 0, variant: "m", z: 5, iconSet: "white", slot: 1 },
	{ x: 1 * STEP_X, y: 0, variant: "c", z: 4, iconSet: "dark", slot: 2 },
	{ x: 2 * STEP_X, y: 0, variant: "s", z: 1 },

	// Main row 3 (bottom), y = STEP_Y
	{ x: -1.5 * STEP_X, y: STEP_Y, variant: "s", z: 1 },
	{ x: -0.5 * STEP_X, y: STEP_Y, variant: "c", z: 2 },
	{ x: 0.5 * STEP_X, y: STEP_Y, variant: "c", z: 2 },
	{ x: 1.5 * STEP_X, y: STEP_Y, variant: "s", z: 1 },
];

const SRC_BY_VARIANT: Record<Variant, string> = {
	m: M_POLY,
	s: S_POLY,
	c: C_POLY,
};

/** Pick three distinct icon indexes; optionally avoid repeating the previous
 *  icon in the same slot so swaps always look like a change. */
function pickUniqueTriplet(prev?: string[]): string[] {
	const pool = [...ICON_INDEXES];
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	const pick = pool.slice(0, 3);
	if (prev) {
		for (let s = 0; s < 3; s++) {
			if (pick[s] === prev[s]) {
				const swap = pool.find((p) => !pick.includes(p));
				if (swap) pick[s] = swap;
			}
		}
	}
	return pick;
}

/** Ring distance from the center hex, used to delay the breathing cascade. */
function ringOf(h: Hex): number {
	if (h.variant === "m") return 0;
	const cx = Math.round((h.x / STEP_X) * 2);
	const ry = Math.round(h.y / STEP_Y);
	return Math.max(Math.abs(ry), Math.ceil((Math.abs(cx) + Math.abs(ry)) / 2));
}

const HexIconSlot = memo(function HexIconSlot({
	iconSet,
	layers,
	slot,
}: {
	iconSet: "dark" | "white";
	layers: IconLayer[];
	slot: number;
}) {
	return (
		<>
			{layers.map((layer) => {
				const src =
					iconSet === "white"
						? whiteSrc(layer.icons[slot])
						: darkSrc(layer.icons[slot]);
				const phaseClass =
					layer.status === "incoming"
						? "hex-icon-in"
						: layer.status === "outgoing"
							? "hex-icon-out"
							: "hex-icon-current";

				return (
					<img
						key={layer.id}
						className={`hex-icon ${phaseClass}`}
						src={src}
						alt=""
						width={32}
						height={32}
						style={{
							position: "absolute",
							top: "50%",
							left: "50%",
							width: 32,
							height: 32,
							zIndex: layer.status === "incoming" ? 11 : 10,
						}}
					/>
				);
			})}
		</>
	);
});

/** The radially-masked polygon cluster (no loading text — that lives outside
 *  the mask). */
export function HexScene() {
	// ── Icon swap state ─────────────────────────────────────────────────────
	const [iconLayers, setIconLayers] = useState<IconLayer[]>(() => [
		{ id: 0, icons: pickUniqueTriplet(), status: "incoming" },
	]);
	const currentLayerRef = useRef<{ id: number; icons: string[] } | null>(null);
	if (currentLayerRef.current == null) {
		currentLayerRef.current = {
			id: iconLayers[0].id,
			icons: iconLayers[0].icons,
		};
	}
	const layerIdRef = useRef(0);

	// Preload all 22 icon files once so swaps never blink.
	useEffect(() => {
		ICON_INDEXES.forEach((n) => {
			const a = new Image();
			a.src = darkSrc(n);
			const b = new Image();
			b.src = whiteSrc(n);
		});
	}, []);

	// ── Icon cycling timeline ────────────────────────────────────────────────
	useEffect(() => {
		let mounted = true;
		const timeouts: number[] = [];
		const FADE = 500;
		const HOLD = 2000;
		const schedule = (callback: () => void, delay: number) => {
			timeouts.push(
				window.setTimeout(() => {
					if (!mounted) return;
					callback();
				}, delay),
			);
		};

		const beginTransition = () => {
			const previous = currentLayerRef.current;
			if (!previous) return;
			const nextIcons = pickUniqueTriplet(previous.icons);
			const nextId = layerIdRef.current + 1;
			layerIdRef.current = nextId;
			currentLayerRef.current = { id: nextId, icons: nextIcons };

			// Overlap old + new for a blink-free crossfade.
			setIconLayers([
				{ id: previous.id, icons: previous.icons, status: "outgoing" },
				{ id: nextId, icons: nextIcons, status: "incoming" },
			]);

			schedule(() => {
				setIconLayers([{ id: nextId, icons: nextIcons, status: "current" }]);
				schedule(beginTransition, HOLD);
			}, FADE);
		};

		// Settle the initial layer, then start cycling.
		schedule(() => {
			const current = currentLayerRef.current;
			if (!current) return;
			setIconLayers([
				{ id: current.id, icons: current.icons, status: "current" },
			]);
			schedule(beginTransition, HOLD);
		}, FADE);

		return () => {
			mounted = false;
			timeouts.forEach(clearTimeout);
		};
	}, []);

	// ── Breathing animation clock ────────────────────────────────────────────
	const [t, setT] = useState(0);
	const startRef = useRef<number | null>(null);
	useEffect(() => {
		let raf = 0;
		const PERIOD = 3200;
		const tick = (now: number) => {
			if (startRef.current == null) startRef.current = now;
			const elapsed = (now - startRef.current) % PERIOD;
			setT(elapsed / PERIOD);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, []);

	const wave = Math.sin(t * Math.PI * 2);
	const AMP = 0.1;
	const RING_DELAY = 0.08;
	const scaleForHex = (h: Hex) => {
		const r = ringOf(h);
		const w = Math.sin((t - r * RING_DELAY) * Math.PI * 2);
		return h.variant === "m" ? 1 + AMP * wave : 1 - AMP * w;
	};

	const sceneW = 7 * STEP_X + HEX_W; // 1184
	const sceneH = 5 * STEP_Y + HEX_H; // 799.5

	return (
		<div
			className="hex-scene-mask"
			style={{ position: "relative", width: sceneW, height: sceneH }}
		>
			{/* Center blue glow circle */}
			<div className="hex-glow" />

			{HEXES.map((h, i) => {
				const s = scaleForHex(h);
				const tx = h.variant === "m" ? h.x : h.x * s;
				const ty = h.variant === "m" ? h.y : h.y * s;

				return (
					<div
						// eslint-disable-next-line react/no-array-index-key
						key={i}
						style={{
							position: "absolute",
							top: "50%",
							left: "50%",
							width: HEX_W,
							height: HEX_H,
							zIndex: h.z,
							transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px)`,
							pointerEvents: "none",
						}}
					>
						<img
							src={SRC_BY_VARIANT[h.variant]}
							alt=""
							draggable={false}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: HEX_W,
								height: "auto",
								transform: `scale(${s})`,
								transformOrigin: "center center",
							}}
						/>

						{h.iconSet && h.slot != null ? (
							<HexIconSlot
								iconSet={h.iconSet}
								layers={iconLayers}
								slot={h.slot}
							/>
						) : null}
					</div>
				);
			})}
		</div>
	);
}

/** Uneven progress driver — exposed as a hook so the loading block can live
 *  outside the masked scene while sharing the same organic progress logic. */
export function useUnevenProgress(): number {
	const [progress, setProgress] = useState(0);
	useEffect(() => {
		let mounted = true;
		let timeout: number;
		const tick = () => {
			if (!mounted) return;
			setProgress((p) => {
				if (p >= 100) return 0;
				const jump =
					Math.random() < 0.35
						? Math.random() * 2 + 0.5
						: Math.random() * 16 + 3;
				return Math.min(100, p + jump);
			});
			timeout = window.setTimeout(tick, 200 + Math.random() * 700);
		};
		timeout = window.setTimeout(tick, 300);
		return () => {
			mounted = false;
			clearTimeout(timeout);
		};
	}, []);
	return progress;
}

/** Loading label (shimmering) + uneven progress bar, pinned near the bottom of
 *  the viewport, sitting over the background and outside the scene mask. */
export function LoadingBlock() {
	const progress = useUnevenProgress();
	return (
		<div className="loading-block">
			<p className="loading-text">Loading Resources</p>
			<div className="progress-track">
				<div className="progress-fill" style={{ width: `${progress}%` }} />
			</div>
		</div>
	);
}
