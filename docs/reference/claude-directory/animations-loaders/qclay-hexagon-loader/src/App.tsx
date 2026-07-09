import { HexScene, LoadingBlock } from "./HexScene";

export default function App() {
	return (
		<main className="loader-root">
			{/* Radially-masked polygon cluster */}
			<HexScene />
			{/* Loading label + uneven progress bar, outside the scene mask */}
			<LoadingBlock />
		</main>
	);
}
