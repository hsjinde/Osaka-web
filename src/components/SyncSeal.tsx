import { useTripState } from '../state/store';

/** 同步中的朱印 loader：非同步中不渲染。 */
export default function SyncSeal() {
  const { syncing } = useTripState();
  if (!syncing) return null;
  return <span className="seal-loader serif" role="status" aria-label="同步中">印</span>;
}
