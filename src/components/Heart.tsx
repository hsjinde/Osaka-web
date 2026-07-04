import { useTripState } from '../state/store';

export default function Heart({ entityId }: { entityId: string }) {
  const { isFav, toggleFav } = useTripState();
  const on = isFav(entityId);
  return (
    <button className={`heart${on ? ' heart--on' : ''}`} aria-label="收藏"
      onClick={() => toggleFav(entityId)}>
      {on ? '♥' : '♡'}
    </button>
  );
}