const AREAS = ['梅田', '心齋橋', '難波', '天王寺'] as const;

export function stripWikilinks(s: string): string {
  return s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, (_, p: string) => p.split('/').pop() ?? p);
}

export function extractArea(s: string): string {
  for (const a of AREAS) if (s.includes(a)) return a;
  return '';
}

export function todoKey(text: string): string {
  let h = 5381;
  for (const ch of text) h = ((h * 33) ^ (ch.codePointAt(0) ?? 0)) >>> 0;
  return 'todo:' + h.toString(16);
}