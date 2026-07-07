import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../../src/data/schema';

/** 由圖片檔絕對路徑算出 R2 key：`osaka/<prefix>/<父資料夾>/<檔名>`。 */
export function imageKey(absPath: string, prefix: 'guides' | 'entities'): string {
  const folder = path.basename(path.dirname(absPath));
  return `osaka/${prefix}/${folder}/${path.basename(absPath)}`;
}

/** 保留原簽名，內部改用 imageKey（輸出不變）。 */
export function guideImageKey(absPath: string): string {
  return imageKey(absPath, 'guides');
}

/** 由 base + key 組公開網址；key 逐段 encodeURIComponent（中文安全，`/` 不編）。 */
export function toPublicUrl(base: string, key: string): string {
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/** 把 Obsidian 圖片嵌入 `![[檔.副檔名]]`（可含 |尺寸 或 #anchor）轉成標準 markdown `![](檔.副檔名)`。
 *  非圖片副檔名的嵌入（如 `![[某筆記]]`）不動。 */
export function embedsToImageMarkdown(s: string): string {
  return s.replace(
    /!\[\[([^\]|#]+?\.(?:png|jpe?g|gif|webp|avif|svg))(?:[|#][^\]]*)?\]\]/gi,
    '![]($1)',
  );
}

/** 解析 markdown 圖片 src 到 vault 內實際檔案的絕對路徑；已是 http 或找不到回 null。 */
export function resolveGuideImage(src: string, guideDir: string, assetRoots: string[]): string | null {
  if (/^https?:\/\//i.test(src)) return null;
  // 1) 相對 guide 目錄
  const rel = path.resolve(guideDir, src);
  if (fs.existsSync(rel) && fs.statSync(rel).isFile()) return rel;
  // 2) 用檔名在 asset 根目錄遞迴搜
  const base = path.basename(src);
  for (const root of assetRoots) {
    const hit = findByBasename(root, base);
    if (hit) return hit;
  }
  return null;
}

function findByBasename(root: string, base: string): string | null {
  if (!fs.existsSync(root)) return null;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isDirectory()) { if (e.name !== '.git') stack.push(path.join(dir, e.name)); }
      else if (e.name === base) return path.join(dir, e.name);
    }
  }
  return null;
}

/** 抽出 body 內所有 markdown 圖片的 src。 */
export function extractImageSrcs(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) out.push(m[1].trim());
  return out;
}

/** 把 body 內可解析的 markdown 圖片 src 換成 `srcToUrl(src)` 的結果；回 null 則原樣保留。 */
export function rewriteImageUrls(body: string, srcToUrl: (src: string) => string | null): string {
  return body.replace(/(!\[[^\]]*\]\()([^)]+)(\))/g, (whole, pre: string, src: string, post: string) => {
    const url = srcToUrl(src.trim());
    return url ? `${pre}${url}${post}` : whole;
  });
}

/** entity 圖片 src → R2 encode 公開網址；解析不到回 null。 */
export function entityImageUrl(
  src: string,
  entityDir: string,
  assetRoots: string[],
  r2Base: string,
): string | null {
  const abs = resolveGuideImage(src, entityDir, assetRoots);
  return abs ? toPublicUrl(r2Base, imageKey(abs, 'entities')) : null;
}

/** 掃 vault 各分類 entity 檔，回傳可上傳的圖片（R2 key → 絕對路徑，已去重）。 */
export function collectEntityImageFiles(vault: string, assetRoots: string[]): Map<string, string> {
  const files = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const dir = path.join(vault, 'wiki/entities', cat);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.md'))) {
      const body = embedsToImageMarkdown(fs.readFileSync(path.join(dir, f), 'utf8'));
      for (const src of extractImageSrcs(body)) {
        const abs = resolveGuideImage(src, dir, assetRoots);
        if (abs) files.set(imageKey(abs, 'entities'), abs);
      }
    }
  }
  return files;
}
