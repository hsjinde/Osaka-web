import { useAuth } from '../state/auth';
import { useTripState } from '../state/store';

export default function Heart({ entityId }: { entityId: string }) {
  const { isFav, toggleFav } = useTripState();
  const { canEdit, openLogin } = useAuth();
  const on = isFav(entityId);
  return (
    <button className={`heart${on ? ' heart--on' : ''}`} aria-label="收藏"
      style={canEdit ? undefined : { opacity: 0.4 }}
      onClick={() => (canEdit ? toggleFav(entityId) : openLogin())}>
      {on ? '♥' : '♡'}
    </button>
  );
}
