import { describe, it, expect } from 'vitest';
import { guideImageKey, rewriteImageUrls } from '../guide-images';

describe('guideImageKey', () => {
  it('用父資料夾＋檔名組 key', () => {
    expect(guideImageKey('/v/原始資料/attachments/threads-zsf4315/image_01.webp'))
      .toBe('osaka/guides/threads-zsf4315/image_01.webp');
    expect(guideImageKey('/v/assets/threads-post/image1.jpg'))
      .toBe('osaka/guides/threads-post/image1.jpg');
  });
});

describe('rewriteImageUrls', () => {
  const toUrl = (src: string) => (src.startsWith('http') ? null : `https://cdn.test/${src.split('/').pop()}`);

  it('改寫可解析的圖片 src', () => {
    expect(rewriteImageUrls('![a](../x/img.jpg)', toUrl)).toBe('![a](https://cdn.test/img.jpg)');
  });

  it('保留 alt 文字', () => {
    expect(rewriteImageUrls('![封面](image1.jpg)', toUrl)).toBe('![封面](https://cdn.test/image1.jpg)');
  });

  it('srcToUrl 回 null 時原樣保留（含已是 http 的）', () => {
    expect(rewriteImageUrls('![a](https://x.com/y.jpg)', toUrl)).toBe('![a](https://x.com/y.jpg)');
  });

  it('一般連結（非圖片）不動', () => {
    expect(rewriteImageUrls('[連結](page.md)', toUrl)).toBe('[連結](page.md)');
  });

  it('多張圖片皆改寫', () => {
    const out = rewriteImageUrls('![](a/1.jpg)\n\n![x](b/2.webp)', toUrl);
    expect(out).toBe('![](https://cdn.test/1.jpg)\n\n![x](https://cdn.test/2.webp)');
  });
});
