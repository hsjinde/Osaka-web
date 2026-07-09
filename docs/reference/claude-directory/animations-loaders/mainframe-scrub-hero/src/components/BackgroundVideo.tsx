import { useEffect, useRef } from "react";

const VIDEO_SRC =
	"/assets/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4";

/** Breakpoint below which scrubbing is disabled and normal playback kicks in. */
const DESKTOP_MIN_WIDTH = 1024;

/** Fraction of the timeline covered by one full-viewport-width mouse sweep. */
const SWEEP_RATIO = 0.8;

/**
 * Full-bleed background video. On desktop (>= 1024px) the cursor's horizontal
 * motion scrubs the film natively via `currentTime`; on smaller screens the
 * video simply autoplays.
 */
export function BackgroundVideo() {
	const videoRef = useRef<HTMLVideoElement>(null);

	// Desktop mouse scrubbing.
	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		let previousX: number | null = null;
		let targetTime: number | null = null;
		let seekInFlight = false;
		let queuedTime: number | null = null;

		// Issue at most one seek at a time; queue the latest target while the
		// browser is busy so tracking stays smooth frame to frame.
		const requestSeek = (time: number) => {
			if (seekInFlight) {
				queuedTime = time;
				return;
			}
			// Skip no-op seeks: the browser fires no `seeked` event for them, which
			// would leave the in-flight flag stuck and wedge the pipeline.
			if (Math.abs(time - video.currentTime) < 0.002) return;
			seekInFlight = true;
			video.currentTime = time;
		};

		const handleSeeked = () => {
			if (
				queuedTime !== null &&
				Math.abs(queuedTime - video.currentTime) >= 0.002
			) {
				video.currentTime = queuedTime;
				queuedTime = null;
			} else {
				queuedTime = null;
				seekInFlight = false;
			}
		};

		const handleMouseMove = (event: MouseEvent) => {
			if (window.innerWidth < DESKTOP_MIN_WIDTH) return; // scrubbing disabled on mobile frames

			if (previousX === null) {
				previousX = event.clientX;
				return;
			}
			const delta = event.clientX - previousX;
			previousX = event.clientX;

			const { duration } = video;
			if (!duration || Number.isNaN(duration)) return;

			const base = targetTime ?? video.currentTime;
			targetTime = Math.min(
				Math.max(
					base + (delta / window.innerWidth) * SWEEP_RATIO * duration,
					0,
				),
				duration,
			);
			requestSeek(targetTime);
		};

		window.addEventListener("mousemove", handleMouseMove);
		video.addEventListener("seeked", handleSeeked);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			video.removeEventListener("seeked", handleSeeked);
		};
	}, []);

	// Mobile autoplay — scrubbing is off below the desktop breakpoint.
	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		if (window.innerWidth < DESKTOP_MIN_WIDTH) {
			video.autoplay = true;
			video.play().catch(() => {
				/* Muted autoplay is normally allowed; ignore policy rejections. */
			});
		}
	}, []);

	return (
		<div className="order-last lg:order-none relative lg:absolute lg:inset-0 lg:z-0 overflow-hidden pointer-events-none w-full aspect-square md:aspect-video lg:aspect-auto lg:h-full bg-neutral-50 lg:bg-transparent">
			<video
				ref={videoRef}
				src={VIDEO_SRC}
				muted
				playsInline
				preload="auto"
				className="w-full h-full object-cover object-right lg:object-right-bottom"
			/>
		</div>
	);
}
