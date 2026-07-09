// Shared geometry, easing tokens, and bezier helpers for the Pallet Ross card overlay.

/** Easing tokens used throughout the page. */
export const smoothEase: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const hoverEase: [number, number, number, number] = [
	0.34, 1.56, 0.64, 1,
];

/** Fixed hero row baseline for the Section 1 fan (px from the top of the viewport). */
export const HERO_ROW_Y = 522;

/** Card footprint (square). */
export const CARD_SIZE = 220;

export type Slot = {
	x: number;
	y: number;
	rotate: number;
	scale: number;
	z: number;
};

/**
 * Section 1 fan layout. All `x` values are relative to the viewport center and
 * all `y` values are relative to HERO_ROW_Y. Seven slots, index 0..6, left→right.
 */
export const SLOTS: Slot[] = [
	{ x: -480, y: 18, rotate: -18, scale: 0.88, z: 1 },
	{ x: -310, y: 6, rotate: -10, scale: 0.92, z: 2 },
	{ x: -155, y: -2, rotate: -4, scale: 0.96, z: 3 },
	{ x: 0, y: -8, rotate: 0, scale: 1, z: 4 },
	{ x: 160, y: -2, rotate: 5, scale: 0.96, z: 3 },
	{ x: 320, y: 6, rotate: 12, scale: 0.92, z: 2 },
	{ x: 480, y: 18, rotate: 20, scale: 0.88, z: 1 },
];

export type Cascade = {
	top: number;
	left: number;
	rotate: number;
	z: number;
};

/**
 * Section 2 diagonal ladder, rendered relative to the overlay wrapper origin.
 * 7-step ladder going from upper-left to lower-right.
 */
export const CASCADE: Cascade[] = Array.from({ length: 7 }, (_, i) => ({
	top: 300 + i * 70,
	left: 20 + i * 150,
	rotate: -3 + i * 3,
	z: 7 - i,
}));

/** Cubic bezier value for the y coordinate given parameter t (control points p0=0, p3=1). */
function cubicBezierY(t: number, p1y: number, p2y: number): number {
	const mt = 1 - t;
	// y(t) = 3(1-t)^2 t * p1y + 3(1-t) t^2 * p2y + t^3   (p0y = 0, p3y = 1)
	return 3 * mt * mt * t * p1y + 3 * mt * t * t * p2y + t * t * t;
}

/** Cubic bezier x coordinate given parameter t (control points p0=0, p3=1). */
function cubicBezierX(t: number, p1x: number, p2x: number): number {
	const mt = 1 - t;
	return 3 * mt * mt * t * p1x + 3 * mt * t * t * p2x + t * t * t;
}

/**
 * Inverts a CSS cubic-bezier easing curve: given the eased *progress* (the y
 * output of the curve), returns the normalized *time* (the x input) that
 * produced it. Used to schedule reveal delays exactly when card 1 visually
 * passes each slot during its left sweep.
 *
 * The easing array is [p1x, p1y, p2x, p2y]. We solve for the bezier parameter t
 * such that bezierY(t) == progress, then return bezierX(t).
 */
export function getTimeForProgress(
	progress: number,
	ease: [number, number, number, number],
): number {
	const [p1x, p1y, p2x, p2y] = ease;
	const target = Math.min(1, Math.max(0, progress));
	// Binary search on the bezier parameter t (curve is monotonic in y here).
	let lo = 0;
	let hi = 1;
	let t = target;
	for (let i = 0; i < 32; i++) {
		t = (lo + hi) / 2;
		const y = cubicBezierY(t, p1y, p2y);
		if (Math.abs(y - target) < 1e-5) break;
		if (y < target) lo = t;
		else hi = t;
	}
	return cubicBezierX(t, p1x, p2x);
}

/** Card image sources, served from /public. */
export const CARD_SRCS = Array.from(
	{ length: 7 },
	(_, i) => `/card-${i + 1}.png`,
);
