export default function Stamp({ rating }: { rating: number | null }) {
  return (
    <div className={`stamp${rating == null ? ' stamp--off' : ''}`}>
      {rating == null ? '—' : rating.toFixed(1)}
    </div>
  );
}