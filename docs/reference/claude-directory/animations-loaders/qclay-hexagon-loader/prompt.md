# QCLAY HEXAGON LOADER

CREATE A SINGLE FULL-SCREEN LOADER PAGE THAT RECREATES THE QCLAY LOADER EXACTLY AS A CENTERED ANIMATED HEXAGON/POLYGON LOADING SCENE.

ROOT ASSET FOLDER FOR REMOTE ICONS: https://qclay.design/lovable/loader/

IMPORTANT: THE ICON SVG FILES ARE IN THAT ROOT FOLDER DIRECTLY, NOT INSIDE /LOADER/ AND NOT INSIDE /POLYGONS/. USE THESE DIRECT PATHS:

- https://qclay.design/lovable/loader/icon-01.svg
- https://qclay.design/lovable/loader/icon-02.svg
- https://qclay.design/lovable/loader/icon-03.svg
- https://qclay.design/lovable/loader/icon-04.svg
- https://qclay.design/lovable/loader/icon-05.svg
- https://qclay.design/lovable/loader/icon-06.svg
- https://qclay.design/lovable/loader/icon-07.svg
- https://qclay.design/lovable/loader/icon-08.svg
- https://qclay.design/lovable/loader/icon-09.svg
- https://qclay.design/lovable/loader/icon-10.svg
- https://qclay.design/lovable/loader/icon-11.svg
- https://qclay.design/lovable/loader/icon-w-01.svg
- https://qclay.design/lovable/loader/icon-w-02.svg
- https://qclay.design/lovable/loader/icon-w-03.svg
- https://qclay.design/lovable/loader/icon-w-04.svg
- https://qclay.design/lovable/loader/icon-w-05.svg
- https://qclay.design/lovable/loader/icon-w-06.svg
- https://qclay.design/lovable/loader/icon-w-07.svg
- https://qclay.design/lovable/loader/icon-w-08.svg
- https://qclay.design/lovable/loader/icon-w-09.svg
- https://qclay.design/lovable/loader/icon-w-10.svg
- https://qclay.design/lovable/loader/icon-w-11.svg

THE POLYGON FILES MUST EXIST LOCALLY IN /POLYGONS/ AND MUST BE CREATED EXACTLY AS THESE THREE FILES:

- public/polygons/c-polygon.svg
- public/polygons/m-polygon.svg
- public/polygons/s-polygon.svg

**public/polygons/c-polygon.svg:**

```svg
<svg width="144" height="160" viewBox="0 0 144 160" fill="none" xmlns="http://www.w3.org/2000/svg"> <g filter="url(#filter0_di_16630_299)"> <path d="M58.9895 3.48358C67.0339 -1.16087 76.9451 -1.16087 84.9895 3.48358L129.354 29.0975C137.398 33.7419 142.354 42.3252 142.354 51.6141V102.842C142.354 112.131 137.398 120.714 129.354 125.359L84.9895 150.972C76.9451 155.617 67.0339 155.617 58.9895 150.972L14.6249 125.359C6.58051 120.714 1.62494 112.131 1.62494 102.842V51.6141C1.62494 42.3252 6.58051 33.7419 14.6249 29.0975L58.9895 3.48358Z" fill="#F0F2FA"/> <path d="M59.802 4.89111C67.3437 0.536939 76.6354 0.536939 84.177 4.89111L128.541 30.5044C136.083 34.8585 140.729 42.9056 140.729 51.6138V102.842C140.729 111.55 136.083 119.598 128.541 123.952L84.177 149.565C76.6354 153.919 67.3437 153.919 59.802 149.565L15.4377 123.952C7.8962 119.598 3.25037 111.55 3.25024 102.842V51.6138C3.25037 42.9056 7.8962 34.8585 15.4377 30.5044L59.802 4.89111Z" stroke="url(#paint0_linear_16630_299)" stroke-width="3.25"/> </g> <defs> <filter id="filter0_di_16630_299" x="0" y="0" width="143.979" height="159.331" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"> <feFlood flood-opacity="0" result="BackgroundImageFix"/> <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/> <feOffset dy="3.25"/> <feGaussianBlur stdDeviation="0.8125"/> <feComposite in2="hardAlpha" operator="out"/> <feColorMatrix type="matrix" values="0 0 0 0 0.298039 0 0 0 0 0.454902 0 0 0 0 0.764706 0 0 0 0.12 0"/> <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_16630_299"/> <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_16630_299" result="shape"/> <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/> <feOffset dy="6.5"/> <feGaussianBlur stdDeviation="2.4375"/> <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/> <feColorMatrix type="matrix" values="0 0 0 0 0.282353 0 0 0 0 0.443137 0 0 0 0 0.745098 0 0 0 0.05 0"/> <feBlend mode="normal" in2="shape" result="effect2_innerShadow_16630_299"/> </filter> <linearGradient id="paint0_linear_16630_299" x1="71.9895" y1="29.2905" x2="71.9895" y2="158.478" gradientUnits="userSpaceOnUse"> <stop stop-color="white"/> <stop offset="0.131728" stop-color="white" stop-opacity="0"/> </linearGradient> </defs> </svg>
```

**public/polygons/m-polygon.svg:**

```svg
<svg width="141" height="155" viewBox="0 0 141 155" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M58.5833 5.59424C65.8735 1.3853 74.8556 1.3853 82.1458 5.59424L126.51 31.2085C133.8 35.4175 138.291 43.1958 138.291 51.6138V102.842C138.291 111.26 133.8 119.039 126.51 123.248L82.1458 148.862C74.8556 153.071 65.8735 153.071 58.5833 148.862L14.219 123.248C6.92884 119.039 2.43787 111.26 2.43774 102.842V51.6138C2.43787 43.1958 6.92884 35.4175 14.219 31.2085L58.5833 5.59424Z" fill="#4770BD" stroke="#365EA7" stroke-width="4.875"/> </svg>
```

**public/polygons/s-polygon.svg:**

```svg
<svg width="141" height="155" viewBox="0 0 141 155" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M57.3645 3.48358C65.4089 -1.16087 75.3201 -1.16087 83.3645 3.48358L127.729 29.0975C135.773 33.7419 140.729 42.3252 140.729 51.6141V102.842C140.729 112.131 135.773 120.714 127.729 125.359L83.3645 150.972C75.3201 155.617 65.4089 155.617 57.3645 150.972L12.9999 125.359C4.95551 120.714 -6.10352e-05 112.131 -6.10352e-05 102.842V51.6141C-6.10352e-05 42.3252 4.95551 33.7419 12.9999 29.0975L57.3645 3.48358Z" fill="#F3F4FC"/> </svg>
```

## OVERALL PAGE

CREATE A FULL VIEWPORT LOADING SCREEN WITH NO HEADER, NO NAVIGATION, NO CARDS, NO EXTRA PAGE CONTENT, AND NO SCROLLBARS. THE BACKGROUND FILLS THE ENTIRE VIEWPORT AND USES A SOFT RADIAL GRADIENT: RADIAL-GRADIENT ELLIPSE AT CENTER, `#EEF1F8` 0%, `#DDE2ED` 100%. THE SCENE IS HORIZONTALLY AND VERTICALLY CENTERED. THE FULL LAYOUT IS POSITION RELATIVE, DISPLAY FLEX, ALIGN-ITEMS CENTER, JUSTIFY-CONTENT CENTER, OVERFLOW HIDDEN, MIN-HEIGHT 100VH, WIDTH 100%.

## MAIN VISUAL

A CENTERED ANIMATED GROUP OF FLAT-TOP HEXAGONAL POLYGON TILES. THE GROUP IS COMPOSED OF THREE POLYGON TYPES:

- S-POLYGON: PALE FLAT FILLED HEXAGON, USED AS THE DISTANT/OUTER LIGHT TILES.
- C-POLYGON: PALE RAISED HEXAGON WITH SUBTLE WHITE TOP GRADIENT STROKE, SMALL BLUE DROP SHADOW, AND BLUE INNER SHADOW, USED AS THE CLOSER LIGHT TILES.
- M-POLYGON: CENTRAL BLUE HEXAGON, USED AS THE ACTIVE MIDDLE TILE.

## POLYGON DIMENSIONS

USE A LOGICAL TILE WIDTH OF 141PX AND HEIGHT OF 155PX FOR POSITIONING ALL POLYGONS. HORIZONTAL GAP IS 8PX. STEP_X = 141 + 8 = 149PX. STEP_Y = 155 * 0.78 + 8 = 128.9PX. HALF = STEP_X / 2 = 74.5PX. SCENE WIDTH = 7 * STEP_X + 141 = 1184PX. SCENE HEIGHT = 5 * STEP_Y + 155 = 799.5PX. THE SCENE CONTAINER IS POSITION RELATIVE, WIDTH 1184PX, HEIGHT 799.5PX.

## SCENE MASK

APPLY A RADIAL MASK TO THE WHOLE POLYGON SCENE SO THE OUTER TILES SOFTLY FADE AWAY: `MASK-IMAGE: RADIAL-GRADIENT(ELLIPSE 45% 55% AT CENTER, #000 0%, RGBA(0,0,0,0.85) 30%, RGBA(0,0,0,0.35) 60%, TRANSPARENT 90%)` -WEBKIT-MASK-IMAGE WITH THE SAME VALUE.

## FULL LAYER HIERARCHY

1. FULLSCREEN ROOT BACKGROUND LAYER.
2. CENTERED SCENE CONTAINER WITH RADIAL MASK.
3. OUTER RING OF S-POLYGONS AT Z-INDEX 0.
4. MAIN TOP AND BOTTOM S-POLYGONS AT Z-INDEX 1.
5. MAIN TOP AND BOTTOM C-POLYGONS AT Z-INDEX 2.
6. CENTER BLUE GLOW CIRCLE AT Z-INDEX 3.
7. LEFT AND RIGHT CENTER-ROW C-POLYGONS AT Z-INDEX 4.
8. CENTER M-POLYGON AT Z-INDEX 5.
9. ICONS INSIDE THE THREE CENTER-ROW ICON POLYGONS AT Z-INDEX 10/11.
10. LOADING TEXT AND PROGRESS BAR OVERLAY POSITIONED NEAR THE BOTTOM OF THE VIEWPORT.

## EXACT POLYGON GRID

ALL TILES ARE ABSOLUTELY POSITIONED INSIDE THE SCENE AT TOP 50%, LEFT 50%, WIDTH 141PX, HEIGHT 155PX. EACH TILE WRAPPER USES `TRANSFORM: TRANSLATE(-50%, -50%) TRANSLATE(XPX, YPX)`. EACH POLYGON IMAGE INSIDE THE WRAPPER IS ABSOLUTE TOP 0 LEFT 0 WIDTH 141PX HEIGHT AUTO AND SCALES FROM ITS CENTER.

USE THESE EXACT TILE POSITIONS AND Z-INDEXES:

OUTER RING, ALL S-POLYGON, Z-INDEX 0:

- X -298, Y -257.8
- X -149, Y -257.8
- X 0, Y -257.8
- X 149, Y -257.8
- X 298, Y -257.8
- X -372.5, Y -128.9
- X 372.5, Y -128.9
- X -447, Y 0
- X 447, Y 0
- X -372.5, Y 128.9
- X 372.5, Y 128.9
- X -298, Y 257.8
- X -149, Y 257.8
- X 0, Y 257.8
- X 149, Y 257.8
- X 298, Y 257.8

MAIN ROW 1, TOP, Y -128.9:

- X -223.5, S-POLYGON, Z-INDEX 1
- X -74.5, C-POLYGON, Z-INDEX 2
- X 74.5, C-POLYGON, Z-INDEX 2
- X 223.5, S-POLYGON, Z-INDEX 1

MAIN ROW 2, CENTER, Y 0:

- X -298, S-POLYGON, Z-INDEX 1
- X -149, C-POLYGON, Z-INDEX 4, CONTAINS DARK ICON SLOT 0
- X 0, M-POLYGON, Z-INDEX 5, CONTAINS WHITE ICON SLOT 1
- X 149, C-POLYGON, Z-INDEX 4, CONTAINS DARK ICON SLOT 2
- X 298, S-POLYGON, Z-INDEX 1

MAIN ROW 3, BOTTOM, Y 128.9:

- X -223.5, S-POLYGON, Z-INDEX 1
- X -74.5, C-POLYGON, Z-INDEX 2
- X 74.5, C-POLYGON, Z-INDEX 2
- X 223.5, S-POLYGON, Z-INDEX 1

## CENTER GLOW

ADD ONE CIRCULAR BLUR GLOW BEHIND THE CENTER ACTIVE ROW BUT ABOVE THE TOP/BOTTOM C-POLYGONS: POSITION ABSOLUTE TOP 50% LEFT 50% WIDTH 120PX HEIGHT 120PX BORDER-RADIUS 50% BACKGROUND RGBA(71, 112, 189, 0.70) FILTER BLUR(37PX) TRANSFORM TRANSLATE(-50%, -50%) Z-INDEX 3 POINTER-EVENTS NONE.

## ICONS

THERE ARE 11 ICON DESIGNS, EACH WITH A DARK BLUE-GRAY VERSION AND A WHITE VERSION. DARK ICONS USE FILES ICON-01.SVG THROUGH ICON-11.SVG. WHITE ICONS USE FILES ICON-W-01.SVG THROUGH ICON-W-11.SVG. THE ICONS ARE PLACED ONLY IN THE THREE CENTER ROW INTERACTIVE POLYGONS: LEFT CENTER C-POLYGON USES DARK ICONS. MIDDLE M-POLYGON USES WHITE ICONS. RIGHT CENTER C-POLYGON USES DARK ICONS. ICON SIZE MUST BE 32PX BY 32PX. ICONS ARE ABSOLUTE INSIDE THEIR POLYGON WRAPPER AT TOP 50%, LEFT 50%. ICON TRANSFORM IS TRANSLATE(-50%, -50%). ICONS MUST HAVE POINTER-EVENTS NONE. ICONS MUST BE VISUALLY CENTERED INSIDE THE HEXAGON.

ICON MEANINGS BY FILE:

- ICON-01.SVG / ICON-W-01.SVG: OUTLINED GAS PUMP / FUEL STATION STYLE SYMBOL.
- ICON-02.SVG / ICON-W-02.SVG: OUTLINED DOCUMENT/FILE WITH FOLDED CORNER AND TWO HORIZONTAL TEXT LINES.
- ICON-03.SVG / ICON-W-03.SVG: OUTLINED TROPHY/CUP WITH BASE AND SIDE HANDLES.
- ICON-04.SVG / ICON-W-04.SVG: OUTLINED CROWN.
- ICON-05.SVG / ICON-W-05.SVG: OUTLINED BIRTHDAY CAKE WITH CANDLES.
- ICON-06.SVG / ICON-W-06.SVG: OUTLINED ROUNDED SQUARE WITH CHECKMARK.
- ICON-07.SVG / ICON-W-07.SVG: OUTLINED TRASH/DELETE BIN.
- ICON-08.SVG / ICON-W-08.SVG: OUTLINED GLOBE WITH MAGNIFYING/SEARCH CIRCLE.
- ICON-09.SVG / ICON-W-09.SVG: OUTLINED LABORATORY FLASK/BAG SHAPE WITH LIQUID WAVE.
- ICON-10.SVG / ICON-W-10.SVG: OUTLINED CLOUD.
- ICON-11.SVG / ICON-W-11.SVG: OUTLINED SUN.

## ICON RANDOMIZATION AND CYCLING

PRELOAD ALL 22 ICON SVG FILES ONCE AT PAGE LOAD. AT ANY MOMENT, EXACTLY THREE ICONS ARE VISIBLE, ONE IN EACH CENTER-ROW ICON SLOT. PICK A UNIQUE RANDOM TRIPLET FROM ICON INDEXES 01 THROUGH 11. THE THREE SLOTS MUST NOT SHOW THE SAME ICON AT THE SAME TIME. EVERY 2000MS AFTER THE CURRENT ANIMATION SETTLES, TRANSITION TO A NEW UNIQUE RANDOM TRIPLET. WHEN PICKING THE NEW TRIPLET, AVOID REPEATING THE SAME ICON IN THE SAME SLOT AS THE PREVIOUS TRIPLET. THE OLD ICONS AND NEW ICONS OVERLAP BRIEFLY DURING TRANSITION SO THERE IS NO BLINK.

## ICON TRANSITION ANIMATION

DURATION 500MS. INCOMING ICON: 0% OPACITY 0, TRANSFORM TRANSLATE(-50%, -50%) TRANSLATEX(20PX); 100% OPACITY 1, TRANSFORM TRANSLATE(-50%, -50%) TRANSLATEX(0). OUTGOING ICON: 0% OPACITY 1, TRANSFORM TRANSLATE(-50%, -50%) TRANSLATEX(0); 100% OPACITY 0, TRANSFORM TRANSLATE(-50%, -50%) TRANSLATEX(-20PX). INCOMING ICONS USE EASE-OUT. OUTGOING ICONS USE EASE-IN. DURING TRANSITION, OUTGOING ICONS HAVE Z-INDEX 10 AND INCOMING ICONS HAVE Z-INDEX 11. CURRENT SETTLED ICONS HAVE NO ANIMATION.

## POLYGON BREATHING ANIMATION

THE ENTIRE POLYGON GRID CONTINUOUSLY BREATHES WITH A SINE-WAVE SCALING MOTION. ANIMATION PERIOD IS 3200MS. USE A REQUESTANIMATIONFRAME LOOP OR EQUIVALENT CONTINUOUS ANIMATION. LET T LOOP FROM 0 TO 1 EVERY 3200MS. WAVE = SIN(T * 2π). AMPLITUDE = 0.10. THE CENTER M-POLYGON SCALE IS 1 + 0.10 * WAVE. ALL NON-CENTER POLYGONS SCALE INVERSELY USING 1 - 0.10 * DELAYEDWAVE. APPLY A RING DELAY SO THE BREATHING CASCADES OUTWARD FROM THE CENTER: RING_DELAY = 0.08 OF THE PERIOD PER RING. FOR EACH POLYGON, COMPUTE ITS RING FROM THE CENTER USING: CX = ROUND((X / STEP_X) * 2); RY = ROUND(Y / STEP_Y); RING = MAX(ABS(RY), CEIL((ABS(CX) + ABS(RY)) / 2)). THE M-POLYGON RING IS 0. FOR EACH NON-CENTER POLYGON: DELAYEDWAVE = SIN((T - RING * 0.08) * 2π); SCALE = 1 - 0.10 * DELAYEDWAVE. FOR THE M-POLYGON: SCALE = 1 + 0.10 * WAVE.

## POLYGON MOVEMENT WHILE SCALING

FOR EVERY NON-CENTER POLYGON, MULTIPLY ITS X AND Y TRANSLATION BY ITS CURRENT SCALE SO THE TILE DRIFTS INWARD/OUTWARD RELATIVE TO THE CENTER AS IT BREATHES: TX = X * SCALE; TY = Y * SCALE. FOR THE CENTER M-POLYGON, KEEP TX = 0 AND TY = 0. EACH POLYGON IMAGE ITSELF ALSO RECEIVES TRANSFORM SCALE(SCALE) WITH TRANSFORM-ORIGIN CENTER CENTER. THIS CREATES THE EXACT EFFECT OF THE BLUE CENTER TILE EXPANDING WHILE SURROUNDING PALE TILES CONTRACT AND DRIFT, THEN REVERSING.

## LOADING TEXT AND PROGRESS BAR BLOCK

PLACE THIS BLOCK OUTSIDE THE MASKED SCENE, OVER THE BACKGROUND. POSITION ABSOLUTE BOTTOM CALC(48PX + 7VH) LEFT 50% TRANSFORM TRANSLATEX(-50%) DISPLAY FLEX FLEX-DIRECTION COLUMN ALIGN-ITEMS CENTER GAP 14PX WIDTH MIN(360PX, 70VW).

## LOADING TEXT

TEXT CONTENT EXACTLY: LOADING RESOURCES. STYLE: FONT-SIZE 12PX FONT-WEIGHT 500 LETTER-SPACING 0.02EM TEXT-TRANSFORM UPPERCASE BASE COLOR RGBA(40, 50, 80, 0.45). USE A MOVING SHIMMER GRADIENT CLIPPED TO THE TEXT: `LINEAR-GRADIENT(115DEG, RGBA(40, 50, 80, 0.45) 0%, RGBA(40, 50, 80, 0.45) 40%, RGBA(71, 112, 189, 1) 50%, RGBA(40, 50, 80, 0.45) 60%, RGBA(40, 50, 80, 0.45) 100%)` BACKGROUND-SIZE 200% 100% BACKGROUND-CLIP TEXT -WEBKIT-BACKGROUND-CLIP TEXT -WEBKIT-TEXT-FILL-COLOR TRANSPARENT. ANIMATION LOADINGSHIMMER: 0% BACKGROUND-POSITION 250% 0; 100% BACKGROUND-POSITION -150% 0; DURATION 2.4S TIMING EASE-IN ITERATION INFINITE.

## PROGRESS BAR

CONTAINER: WIDTH 100% HEIGHT 3PX BACKGROUND RGBA(40, 50, 80, 0.12) OVERFLOW HIDDEN NO BORDER RADIUS UNLESS NECESSARY; KEEP IT THIN AND FLAT. INNER FILL: HEIGHT 100% BACKGROUND RGBA(71, 112, 189, 0.95) WIDTH CHANGES FROM 0% TO 100% TRANSITION WIDTH 0.35S EASE-OUT.

## PROGRESS BEHAVIOR

START AT 0. LOOP FOREVER. EVERY TICK OCCURS AFTER A RANDOM DELAY BETWEEN 200MS AND 900MS. INITIAL FIRST TICK AFTER 300MS. ON EVERY TICK, IF PROGRESS IS 100 OR MORE, RESET TO 0. OTHERWISE ADD AN UNEVEN RANDOM JUMP: 35% CHANCE: ADD BETWEEN 0.5 AND 2.5. 65% CHANCE: ADD BETWEEN 3 AND 19. CLAMP TO 100. THIS MAKES THE PROGRESS BAR FEEL ORGANIC AND UNEVEN, NOT LINEAR.

## EXACT CSS FOR ICON AND TEXT ANIMATIONS

```css
@keyframes hexFadeInRight { 0% { opacity: 0; transform: translate(-50%, -50%) translateX(20px); } 100% { opacity: 1; transform: translate(-50%, -50%) translateX(0); } } @keyframes hexFadeOutLeft { 0% { opacity: 1; transform: translate(-50%, -50%) translateX(0); } 100% { opacity: 0; transform: translate(-50%, -50%) translateX(-20px); } } .hex-icon { display: block; opacity: 1; transform: translate(-50%, -50%); transform-origin: center center; backface-visibility: hidden; will-change: opacity, transform; pointer-events: none; } .hex-icon-current { animation: none; } .hex-icon-in { animation: hexFadeInRight 0.5s ease-out forwards; } .hex-icon-out { animation: hexFadeOutLeft 0.5s ease-in forwards; } @keyframes loadingShimmer { 0% { background-position: 250% 0; } 100% { background-position: -150% 0; } } .loading-text { font-size: 12px; font-weight: 500; letter-spacing: 0.02em; text-transform: uppercase; color: rgba(40, 50, 80, 0.45); background: linear-gradient( 115deg, rgba(40, 50, 80, 0.45) 0%, rgba(40, 50, 80, 0.45) 40%, rgba(71, 112, 189, 1) 50%, rgba(40, 50, 80, 0.45) 60%, rgba(40, 50, 80, 0.45) 100% ); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: loadingShimmer 2.4s ease-in infinite; }
```

## IMPLEMENTATION CODE FOR THE LOADER COMPONENT

USE THIS EXACT REACT COMPONENT LOGIC IF WRITING IN REACT, BECAUSE THIS IS THE SAFEST WAY TO REPRODUCE ALL POSITIONS, LAYER ORDER, RANDOM ICONS, BREATHING ANIMATION, LOADING TEXT SHIMMER, AND UNEVEN PROGRESS BEHAVIOR:

```tsx
import { memo, useEffect, useRef, useState } from "react";

const ICON_INDEXES = ["01","02","03","04","05","06","07","08","09","10","11"]; const darkSrc = (n: string) => `/loader/icon-${n}.svg`; const whiteSrc = (n: string) => `/loader/icon-w-${n}.svg`;

const M_POLY = "/polygons/m-polygon.svg"; const S_POLY = "/polygons/s-polygon.svg"; const C_POLY = "/polygons/c-polygon.svg";

const HEX_W = 141; const HEX_H = 155; const GAP = 8; const STEP_X = HEX_W + GAP; const STEP_Y = HEX_H * 0.78 + GAP;

type Variant = "s" | "c" | "m"; type Hex = { x: number; y: number; variant: Variant; z: number; iconSet?: "dark" | "white"; slot?: number; };

type IconLayerStatus = "current" | "incoming" | "outgoing"; type IconLayer = { id: number; icons: string[]; status: IconLayerStatus; };

const HEXES: Hex[] = [ { x: -2 * STEP_X, y: -2 * STEP_Y, variant: "s", z: 0 }, { x: -1 * STEP_X, y: -2 * STEP_Y, variant: "s", z: 0 }, { x: 0, y: -2 * STEP_Y, variant: "s", z: 0 }, { x: 1 * STEP_X, y: -2 * STEP_Y, variant: "s", z: 0 }, { x: 2 * STEP_X, y: -2 * STEP_Y, variant: "s", z: 0 }, { x: -2.5 * STEP_X, y: -STEP_Y, variant: "s", z: 0 }, { x: 2.5 * STEP_X, y: -STEP_Y, variant: "s", z: 0 }, { x: -3 * STEP_X, y: 0, variant: "s", z: 0 }, { x: 3 * STEP_X, y: 0, variant: "s", z: 0 }, { x: -2.5 * STEP_X, y: STEP_Y, variant: "s", z: 0 }, { x: 2.5 * STEP_X, y: STEP_Y, variant: "s", z: 0 }, { x: -2 * STEP_X, y: 2 * STEP_Y, variant: "s", z: 0 }, { x: -1 * STEP_X, y: 2 * STEP_Y, variant: "s", z: 0 }, { x: 0, y: 2 * STEP_Y, variant: "s", z: 0 }, { x: 1 * STEP_X, y: 2 * STEP_Y, variant: "s", z: 0 }, { x: 2 * STEP_X, y: 2 * STEP_Y, variant: "s", z: 0 },

{ x: -1.5 * STEP_X, y: -STEP_Y, variant: "s", z: 1 }, { x: -0.5 * STEP_X, y: -STEP_Y, variant: "c", z: 2 }, { x: 0.5 * STEP_X, y: -STEP_Y, variant: "c", z: 2 }, { x: 1.5 * STEP_X, y: -STEP_Y, variant: "s", z: 1 },

{ x: -2 * STEP_X, y: 0, variant: "s", z: 1 }, { x: -1 * STEP_X, y: 0, variant: "c", z: 4, iconSet: "dark", slot: 0 }, { x: 0, y: 0, variant: "m", z: 5, iconSet: "white", slot: 1 }, { x: 1 * STEP_X, y: 0, variant: "c", z: 4, iconSet: "dark", slot: 2 }, { x: 2 * STEP_X, y: 0, variant: "s", z: 1 },

{ x: -1.5 * STEP_X, y: STEP_Y, variant: "s", z: 1 }, { x: -0.5 * STEP_X, y: STEP_Y, variant: "c", z: 2 }, { x: 0.5 * STEP_X, y: STEP_Y, variant: "c", z: 2 }, { x: 1.5 * STEP_X, y: STEP_Y, variant: "s", z: 1 }, ];

function pickUniqueTriplet(prev?: string[]): string[] { const pool = [...ICON_INDEXES]; for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; } let pick = pool.slice(0, 3); if (prev) { for (let s = 0; s < 3; s++) { if (pick[s] === prev[s]) { const swap = pool.find((p) => !pick.includes(p)); if (swap) pick[s] = swap; } } } return pick; }

const SRC_BY_VARIANT: Record<Variant, string> = { m: M_POLY, s: S_POLY, c: C_POLY, };

function ringOf(h: Hex): number { if (h.variant === "m") return 0; const cx = Math.round((h.x / STEP_X) * 2); const ry = Math.round(h.y / STEP_Y); return Math.max(Math.abs(ry), Math.ceil((Math.abs(cx) + Math.abs(ry)) / 2)); }

const HexIconSlot = memo(function HexIconSlot({ iconSet, layers, slot, }: { iconSet: "dark" | "white"; layers: IconLayer[]; slot: number; }) { return ( <> {layers.map((layer) => { const src = iconSet === "white" ? whiteSrc(layer.icons[slot]) : darkSrc(layer.icons[slot]); const phaseClass = layer.status === "incoming" ? "hex-icon-in" : layer.status === "outgoing" ? "hex-icon-out" : "hex-icon-current";

    return (
      <img key={layer.id} className={`hex-icon ${phaseClass}`} src={src} alt="" width={32} height={32} style={{ position: "absolute", top: "50%", left: "50%", width: 32, height: 32, zIndex: layer.status === "incoming" ? 11 : 10 }} />
    );
  })}
</> ); });

export function HexScene() { const [iconLayers, setIconLayers] = useState<IconLayer[]>(() => [ { id: 0, icons: pickUniqueTriplet(), status: "incoming" }, ]); const currentLayerRef = useRef<{ id: number; icons: string[] } | null>(null); if (currentLayerRef.current == null) { currentLayerRef.current = { id: iconLayers[0].id, icons: iconLayers[0].icons }; } const layerIdRef = useRef(0);

useEffect(() => { ICON_INDEXES.forEach((n) => { const a = new Image(); a.src = darkSrc(n); const b = new Image(); b.src = whiteSrc(n); }); }, []);

const [progress, setProgress] = useState(0); useEffect(() => { let mounted = true; let timeout: number; const tick = () => { if (!mounted) return; setProgress((p) => { if (p >= 100) return 0; const jump = Math.random() < 0.35 ? Math.random() * 2 + 0.5 : Math.random() * 16 + 3; return Math.min(100, p + jump); }); timeout = window.setTimeout(tick, 200 + Math.random() * 700); }; timeout = window.setTimeout(tick, 300); return () => { mounted = false; clearTimeout(timeout); }; }, []);

useEffect(() => { let mounted = true; const timeouts: number[] = []; const FADE = 500; const HOLD = 2000; const schedule = (callback: () => void, delay: number) => { timeouts.push( window.setTimeout(() => { if (!mounted) return; callback(); }, delay), ); };

const beginTransition = () => {
  const previous = currentLayerRef.current;
  if (!previous) return;
  const nextIcons = pickUniqueTriplet(previous.icons);
  const nextId = layerIdRef.current + 1;
  layerIdRef.current = nextId;
  currentLayerRef.current = { id: nextId, icons: nextIcons };

  setIconLayers([
    { id: previous.id, icons: previous.icons, status: "outgoing" },
    { id: nextId, icons: nextIcons, status: "incoming" },
  ]);

  schedule(() => {
    setIconLayers([{ id: nextId, icons: nextIcons, status: "current" }]);
    schedule(beginTransition, HOLD);
  }, FADE);
};

schedule(() => {
  const current = currentLayerRef.current;
  if (!current) return;
  setIconLayers([{ id: current.id, icons: current.icons, status: "current" }]);
  schedule(beginTransition, HOLD);
}, FADE);

return () => {
  mounted = false;
  timeouts.forEach(clearTimeout);
};
}, []);

const [t, setT] = useState(0); const startRef = useRef<number | null>(null); useEffect(() => { let raf = 0; const PERIOD = 3200; const tick = (now: number) => { if (startRef.current == null) startRef.current = now; const elapsed = (now - startRef.current) % PERIOD; setT(elapsed / PERIOD); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, []);

const wave = Math.sin(t * Math.PI * 2); const AMP = 0.10; const RING_DELAY = 0.08; const scaleForHex = (h: Hex) => { const r = ringOf(h); const w = Math.sin((t - r * RING_DELAY) * Math.PI * 2); return h.variant === "m" ? 1 + AMP * wave : 1 - AMP * w; };

const sceneW = 7 * STEP_X + HEX_W; const sceneH = 5 * STEP_Y + HEX_H;

return ( <div style={{ position: "relative", width: sceneW, height: sceneH }}> ... {HEXES.map((h, i) => { const s = scaleForHex(h); const tx = h.variant === "m" ? h.x : h.x * s; const ty = h.variant === "m" ? h.y : h.y * s; return ( ... {h.iconSet && h.slot != null ? ( <HexIconSlot iconSet={h.iconSet} layers={iconLayers} slot={h.slot} /> ) : null} ... ); })} ... Loading Resources ... ); }
```

## FINAL ACCURACY REQUIREMENTS

DO NOT OMIT POLYGONS. DO NOT REPLACE POLYGONS WITH CSS CLIP-PATH APPROXIMATIONS. DO NOT USE CIRCLES, ROUNDED RECTANGLES, CARDS, GRADIENTS, OR GENERIC PLACEHOLDERS INSTEAD OF THE SUPPLIED POLYGON SVGS. DO NOT PUT THE ICONS IN RANDOM POSITIONS; ONLY THE THREE CENTER ROW POLYGONS CONTAIN ICONS. DO NOT ADD TEXT EXCEPT "LOADING RESOURCES". DO NOT ADD A LOGO, MENU, HEADER, FOOTER, PAGE TITLE, OR ANY QCLAY HOMEPAGE CONTENT. THE LOADER MUST BE THE ONLY VISIBLE PAGE. THE FINAL RESULT MUST LOOK LIKE A PALE BLUE-GRAY FULLSCREEN LOADING SCENE WITH A CENTERED HONEYCOMB/HEXAGON CLUSTER, A BLUE CENTER HEXAGON, SUBTLE BLUE GLOW BEHIND IT, ANIMATED ICON SWAPPING, BREATHING POLYGON MOTION, SHIMMERING LOADING LABEL, AND UNEVEN ANIMATED PROGRESS BAR.
