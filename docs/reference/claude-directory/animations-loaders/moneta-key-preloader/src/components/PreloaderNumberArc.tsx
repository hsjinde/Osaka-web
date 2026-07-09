import { useEffect, useRef } from "react";

/**
 * Curved, canvas-based 0–100 number scroller.
 *
 * Numbers are laid out along a large-radius arc whose centre sits well below the
 * visible canvas, so only the very top sliver of the circle shows — giving the
 * numbers a gentle, horizontal-but-curved track. The number closest to the top
 * of the arc (the "focal" number) scales up and gains a soft cool-blue glow,
 * while neighbours fade out via a power curve.
 *
 * The underlying `progress` prop jumps in irregular chunks (see the progress
 * driver in Preloader). To keep the scroll buttery, the component eases its own
 * animated value toward the target with a small per-frame lerp factor, so the
 * numbers slide with inertia rather than snapping.
 */

const CANVAS_WIDTH = 550;
const CANVAS_HEIGHT = 70;
const ARC_RADIUS = 310;
const CENTER_X = CANVAS_WIDTH / 2; // 275
const CENTER_Y = 330; // well below the visible canvas
const CENTER_ANGLE = -Math.PI / 2; // straight up
const ANGLE_STEP = Math.PI / 16;
const FONT_SIZE = 17;
const FONT = `300 ${FONT_SIZE}px "Inter Tight", sans-serif`;
const VISIBLE_DISTANCE = 5;

interface PreloaderNumberArcProps {
	progress: number;
}

const PreloaderNumberArc = ({ progress }: PreloaderNumberArcProps) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const animatedProgressRef = useRef(0);
	const targetProgressRef = useRef(0);
	const frameRef = useRef<number | null>(null);
	// Drives the easing loop; lives in a ref so the prop-watching effect can call
	// it without re-running the heavy setup effect.
	const kickRef = useRef<() => void>(() => {});

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const ratio = window.devicePixelRatio || 1;
		// Style size stays fixed; backing store scales with DPR for crisp text.
		canvas.width = CANVAS_WIDTH * ratio;
		canvas.height = CANVAS_HEIGHT * ratio;

		const draw = (value: number) => {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.scale(ratio, ratio);
			ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
			ctx.save();
			ctx.beginPath();
			ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
			ctx.clip();
			ctx.font = FONT;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";

			for (let number = 0; number <= 100; number += 1) {
				const distance = number - value;
				const absDistance = Math.abs(distance);
				if (absDistance > VISIBLE_DISTANCE) continue;
				const angle = CENTER_ANGLE + distance * ANGLE_STEP;
				const x = CENTER_X + Math.cos(angle) * ARC_RADIUS;
				const y = CENTER_Y + Math.sin(angle) * ARC_RADIUS;
				if (x < -80 || x > 630 || y < -20 || y > 90) continue;
				const fade = (1 - absDistance / VISIBLE_DISTANCE) ** 2.2;
				const opacity = Math.max(0, 0.95 * fade);
				const focal = Math.max(0, 1 - absDistance / 1.2);
				const scale = 1 + focal * 0.35;
				ctx.save();
				ctx.translate(x, y);
				ctx.scale(scale, scale);
				if (focal > 0.05) {
					ctx.shadowColor = `rgba(180, 200, 255, ${focal * 0.9})`;
					ctx.shadowBlur = 18 * focal;
				}
				ctx.fillStyle = `rgba(255,255,255,${opacity})`;
				ctx.fillText(String(number), 0, 0);
				ctx.restore();
			}
			ctx.restore();
		};

		const tick = () => {
			const current = animatedProgressRef.current;
			const target = targetProgressRef.current;
			const delta = target - current;
			if (Math.abs(delta) < 0.001) {
				animatedProgressRef.current = target;
				draw(target);
				frameRef.current = null;
				return;
			}
			animatedProgressRef.current = current + delta * 0.045;
			draw(animatedProgressRef.current);
			frameRef.current = requestAnimationFrame(tick);
		};

		// Start the easing loop only when it is idle, so prop updates never spawn
		// competing rAF chains.
		kickRef.current = () => {
			if (frameRef.current === null) {
				frameRef.current = requestAnimationFrame(tick);
			}
		};

		// Initial paint so the arc is visible before any progress update, then
		// ease toward whatever target is already set.
		draw(animatedProgressRef.current);
		kickRef.current();

		return () => {
			if (frameRef.current !== null) {
				cancelAnimationFrame(frameRef.current);
				frameRef.current = null;
			}
			kickRef.current = () => {};
		};
	}, []);

	// Whenever the target progress changes, update the target and (re)start the
	// easing loop if it has settled.
	useEffect(() => {
		targetProgressRef.current = progress;
		kickRef.current();
	}, [progress]);

	return (
		<div
			aria-hidden="true"
			style={{
				position: "absolute",
				left: "50%",
				bottom: 123,
				transform: "translateX(-50%)",
				width: CANVAS_WIDTH,
				height: CANVAS_HEIGHT,
				zIndex: 4,
				pointerEvents: "none",
				overflow: "hidden",
			}}
		>
			<canvas
				ref={canvasRef}
				style={{
					display: "block",
					width: "100%",
					height: "100%",
					WebkitMaskImage:
						"radial-gradient(ellipse 55% 100% at 50% 50%, black 0%, rgba(0,0,0,0.85) 35%, rgba(0,0,0,0.4) 65%, transparent 100%)",
					maskImage:
						"radial-gradient(ellipse 55% 100% at 50% 50%, black 0%, rgba(0,0,0,0.85) 35%, rgba(0,0,0,0.4) 65%, transparent 100%)",
				}}
			/>
		</div>
	);
};

export default PreloaderNumberArc;
