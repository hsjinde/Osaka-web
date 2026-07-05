import fs from 'node:fs';
import path from 'node:path';

/** 由圖片檔的絕對路徑算出 R2 key：`osaka/guides/<父資料夾>/<檔名>`（父資料夾為 ASCII、不撞名）。 */
export function guideImageKey(absPath: string): string {
  const folder = path.basename(path.dirname(absPath));
  return `osaka/guides/${folder}/${path.basename(absPath)}`;
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
