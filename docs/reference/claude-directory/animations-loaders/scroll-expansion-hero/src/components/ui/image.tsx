import type { CSSProperties } from "react";

// Minimal drop-in stand-in for `next/image` so the source component can be
// pasted verbatim into a Vite app. It renders a plain <img> and quietly
// ignores Next-only props (`priority`, numeric `width`/`height` as layout
// hints, etc.) while honouring the real DOM attributes that matter.
interface ImageProps {
	src: string;
	alt: string;
	width?: number;
	height?: number;
	className?: string;
	style?: CSSProperties;
	priority?: boolean;
}

const Image = ({ src, alt, width, height, className, style }: ImageProps) => {
	return (
		<img
			src={src}
			alt={alt}
			width={width}
			height={height}
			className={className}
			style={style}
			draggable={false}
			loading="eager"
			decoding="async"
		/>
	);
};

export default Image;
