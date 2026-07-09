import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { CATEGORIES, MetaSchema, type Entity, type Guide } from '../src/data/schema';
import { parseEntity } from './lib/parse-entity';
import { parseItinerary } from './lib/parse-itinerary';
import { parseTodos } from './lib/parse-todos';
import { parseGuide } from './lib/parse-guide';
import { resolveGuideImage, guideImageKey, rewriteImageUrls, entityImageUrl } from './lib/guide-images';

export function isEntityFile(cat: string, filename: string): boolean {
  return filename.endsWith('.md') && filename !== `${cat}總覽.md`;
}

export function buildOverview(raw: string): {
  fields: Record<string, string>;
  transportNotes: string[];
} {
  const { content } = matter(raw.replace(/\r\n/g, '\n'));
  const fields: Record<string, string> = {};
  const base = content.match(/## 基本資訊\n([\s\S]*?)(?=\n## |$)/);
  if (base) {
    for (const line of base[1].split('\n')) {
      const m = line.match(/^- (.+?)[：:]\s*(.*)$/);
      if (m) fields[m[1].trim()] = m[2].trim();
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields['出發'] ?? ''))
    throw new Error('總覽.md：「出發」欄位缺少或不是 YYYY-MM-DD');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields['回程'] ?? ''))
    throw new Error('總覽.md：「回程」欄位缺少或不是 YYYY-MM-DD');

  const trans = content.match(/## 交通備註\n([\s\S]*?)(?=\n## |$)/);
  const transportNotes = (trans?.[1] ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2));
  return { fields, transportNotes };
}

function main() {
  const vault = process.env.NOTES_DIR;
  if (!vault || !fs.existsSync(vault)) {
    console.error(`NOTES_DIR 未設定或不存在：${vault}`);
    process.exit(1);
  }
  const out = path.join(import.meta.dirname, '../src/data');
  fs.mkdirSync(out, { recursive: true });
  const write = (name: string, data: unknown) =>
    fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 1), 'utf8');

  const r2Base = (process.env.R2_PUBLIC_URL_PREFIX || 'https://img.19980803.xyz').replace(/\/+$/, '');
  const assetRoots = [path.join(vault, 'assets'), path.join(vault, '原始資料/attachments')];

  const errors: string[] = [];
  const entities: Entity[] = [];
  for (const cat of CATEGORIES) {
    const dir = path.join(vault, 'wiki/entities', cat);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => isEntityFile(cat, f))) {
      try {
        const ent = parseEntity(cat, f, fs.readFileSync(path.join(dir, f), 'utf8'));
        ent.body = rewriteImageUrls(ent.body, (src) => entityImageUrl(src, dir, assetRoots, r2Base));
        entities.push(ent);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }

  // 別人推薦攻略（補充內容：best-effort，解析失敗只警告不擋建置）
  const guides: Guide[] = [];
  const guidesDir = path.join(vault, '原始資料/別人行程');
  if (fs.existsSync(guidesDir)) {
    for (const f of fs.readdirSync(guidesDir).filter((f) => f.endsWith('.md'))) {
      try {
        const g = parseGuide(f, fs.readFileSync(path.join(guidesDir, f), 'utf8'));
        g.body = rewriteImageUrls(g.body, (src) => {
          const abs = resolveGuideImage(src, guidesDir, assetRoots);
          return abs ? `${r2Base}/${guideImageKey(abs)}` : null;
        });
        guides.push(g);
      } catch (e) {
        console.warn(`⚠ 攻略略過 ${f}：${e instanceof Error ? e.message : e}`);
      }
    }
  }

  let days, todos, overview;
  try {
    days = parseItinerary(fs.readFileSync(path.join(vault, 'wiki/dashboard/每日行程.md'), 'utf8'));
  } catch (e) { errors.push(String(e instanceof Error ? e.message : e)); }
  try {
    overview = buildOverview(fs.readFileSync(path.join(vault, 'wiki/dashboard/總覽.md'), 'utf8'));
  } catch (e) { errors.push(String(e instanceof Error ? e.message : e)); }
  try {
    todos = parseTodos(
      fs.readFileSync(path.join(vault, 'Osaka Trip/2026-09-30-osaka-confirmed-itinerary.md'), 'utf8'),
    );
  } catch (e) { errors.push(String(e instanceof Error ? e.message : e)); }

  if (errors.length || !days || !todos || !overview) {
    console.error(`❌ 資料建置失敗（${errors.length} 個錯誤）：`);
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }

  const meta = MetaSchema.parse({
    builtAt: new Date().toISOString(),
    tripStart: overview.fields['出發'],
    tripEnd: overview.fields['回程'],
  });

  write('entities.json', entities);
  write('days.json', days);
  write('todos.json', todos);
  write('overview.json', overview);
  write('meta.json', meta);
  write('guides.json', guides);
  console.log(
    `✅ 建置完成：${entities.length} 實體、${days.length} 天行程、${todos.length} 待辦、${guides.length} 攻略`,
  );
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) main();