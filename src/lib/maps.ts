/** 由店名（＋區域，缺則補「大阪」）產生 Google 地圖搜尋連結。 */
export function googleMapsUrl(name: string, area?: string): string {
  const query = `${name} ${area || '大阪'}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
