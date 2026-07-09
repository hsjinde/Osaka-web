import { motion } from "framer-motion";
import { Film, ImageIcon, MousePointer2 } from "lucide-react";
import { useEffect, useState } from "react";
import MediaContent, { sampleMediaContent } from "@/components/media-content";
import ScrollExpandMedia from "@/components/ui/scroll-expansion-hero";

type MediaType = "video" | "image";

const App = () => {
	const [mediaType, setMediaType] = useState<MediaType>("video");
	const current = sampleMediaContent[mediaType];

	useEffect(() => {
		window.scrollTo(0, 0);
		window.dispatchEvent(new Event("resetSection"));
	}, []);

	return (
		<main className="relative min-h-[100dvh] bg-ink text-white selection:bg-iris/40">
			{/* Brand mark */}
			<div className="pointer-events-none fixed left-6 top-6 z-50 flex items-center gap-2.5 mix-blend-difference">
				<span className="grid h-7 w-7 place-items-center rounded-lg border border-white/40">
					<span className="h-2.5 w-2.5 rounded-[3px] bg-white animate-pulse-dot" />
				</span>
				<span className="font-display text-sm font-semibold tracking-tight text-white">
					UNFURL
				</span>
			</div>

			{/* Media type toggle */}
			<div className="fixed right-6 top-6 z-50 flex items-center gap-1 rounded-full border border-white/15 bg-black/40 p-1 backdrop-blur-md">
				<button
					onClick={() => setMediaType("video")}
					aria-pressed={mediaType === "video"}
					className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
						mediaType === "video"
							? "bg-white text-ink"
							: "text-white/60 hover:text-white"
					}`}
				>
					<Film className="h-3.5 w-3.5" />
					Video
				</button>
				<button
					onClick={() => setMediaType("image")}
					aria-pressed={mediaType === "image"}
					className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
						mediaType === "image"
							? "bg-white text-ink"
							: "text-white/60 hover:text-white"
					}`}
				>
					<ImageIcon className="h-3.5 w-3.5" />
					Image
				</button>
			</div>

			{/* Scroll cue */}
			<motion.div
				className="pointer-events-none fixed bottom-7 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2 mix-blend-difference"
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.6 }}
			>
				<MousePointer2 className="h-4 w-4 text-white" />
				<span className="font-mono text-[10px] uppercase tracking-[0.35em] text-white">
					scroll
				</span>
				<span className="h-9 w-px bg-gradient-to-b from-white to-transparent" />
			</motion.div>

			<ScrollExpandMedia
				key={mediaType}
				mediaType={mediaType}
				mediaSrc={current.src}
				posterSrc={mediaType === "video" ? current.poster : undefined}
				bgImageSrc={current.background}
				title={current.title}
				date={current.date}
				scrollToExpand={current.scrollToExpand}
				textBlend
			>
				<MediaContent mediaType={mediaType} />
			</ScrollExpandMedia>
		</main>
	);
};

export default App;
