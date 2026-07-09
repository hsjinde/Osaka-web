import { apiBase, getToken } from './state';

/** 送整份行程區塊 markdown 給 Worker commit 回 vault。 */
export async function putItinerary(daySectionsMarkdown: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/itinerary`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${getToken() ?? ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ daySectionsMarkdown }),
  });
  if (res.status === 409) throw new Error('檔案已在他處變更，請重新整理後再試');
  if (!res.ok) throw new Error(`PUT itinerary ${res.status}`);
}
