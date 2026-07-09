// Brand color — a muted warm grey used for almost all body / headline text on
// light backgrounds, and as the soft fill behind the yellow-green serif glow.
export const TEXT_COLOR = "#545454";

// The signature fluorescent yellow-green halo color.
export const GLOW_COLOR = "#EAFE79";

// Asset host. The spec fetches imagery from `https://qclay.design/lovable/bags`,
// joined as `${ASSET}/${file}`. Following this repo's convention, every asset is
// vendored locally under `public/assets` and served from the site root, so the
// project is fully self-contained and runnable offline. The join semantics are
// identical to the original `${ASSET}/${file}`.
export const ASSET = "/assets";

export const asset = (file: string): string => `${ASSET}/${file}`;
