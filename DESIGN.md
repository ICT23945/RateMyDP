---
name: Aperture & Form
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8fd'
  surface-container-highest: '#dce2f7'
  on-surface: '#141b2b'
  on-surface-variant: '#444653'
  inverse-surface: '#293040'
  inverse-on-surface: '#edf0ff'
  outline: '#757684'
  outline-variant: '#c4c5d5'
  surface-tint: '#3755c3'
  primary: '#00288e'
  on-primary: '#ffffff'
  primary-container: '#1e40af'
  on-primary-container: '#a8b8ff'
  inverse-primary: '#b8c4ff'
  secondary: '#4e45d5'
  on-secondary: '#ffffff'
  secondary-container: '#6860ef'
  on-secondary-container: '#fffbff'
  tertiary: '#003c36'
  on-tertiary: '#ffffff'
  tertiary-container: '#00554e'
  on-tertiary-container: '#5fcdbf'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c4ff'
  on-primary-fixed: '#001453'
  on-primary-fixed-variant: '#173bab'
  secondary-fixed: '#e3dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#100069'
  on-secondary-fixed-variant: '#372abf'
  tertiary-fixed: '#89f5e7'
  tertiary-fixed-dim: '#6bd8cb'
  on-tertiary-fixed: '#00201d'
  on-tertiary-fixed-variant: '#005049'
  background: '#f9f9ff'
  on-background: '#141b2b'
  surface-variant: '#dce2f7'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.015em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.06em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 9px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.5rem
  gutter-lg: 1.5rem
  margin: 1.25rem
  margin-mobile: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system expresses the discipline of fine-art portrait photography through the precision of contemporary mobile utility. It frames analysis not as an automated pass/fail judgment, but as an editorial critique: calm, discerning, and optically grounded. 

The aesthetic synthesizes gallery minimalism with lens-instrument detailing. Surfaces feel like warm cotton rag paper under daylight, punctuated by sharp slate hairline dividers and technical aperture accents. The UI recedes completely to let user portraits occupy the visual foreground, acting as a quiet viewing loupe rather than an intrusive interface. The emotional response is one of trust, high craft, and analytical clarity.

## Colors

The palette is anchored by gallery neutrals and a precise optical blue spectrum:

- **Canvas & Surfaces**: The base canvas is `#FAFAF9` (warm off-white / archival paper). Surface layers elevate to `#FFFFFF` for analyzed cards and `#F3F4F6` for recessed metering wells.
- **Brand Accents**: The primary anchor is `#1E40AF` (Deep Lens Blue), paired with `#4338CA` (Indigo Aperture) for active scanning and computational focus indicators. A calibrated teal (`#0D9488`) handles positive composition indicators without turning garish.
- **Typography & Structural Contrast**: `#111827` (Deep Obsidian Charcoal) delivers stark, optical legibility without the harshness of pure black. Secondary copy uses `#4B5563` (Neutral Slate).
- **Hairlines & Dividers**: Borders strictly use `#E2E8F0` with controlled opacity (60%–80%) to emulate precision lens measurement reticles rather than heavy structural containers.
- **Status & Diagnostic Tones**: Success (`#059669`), Warning (`#D97706`), and Error (`#DC2626`) are muted to maintain tonal cohesion within the editorial view.

## Typography

The typographic hierarchy implements three distinct roles:

1. **Display & Evaluation (`Space Grotesk`)**: Technical yet expressive geometric letterforms with tight tracking convey editorial sophistication and mechanical precision. Used exclusively for titles, section headers, and final overall ratings.
2. **Body & Critique Narrative (`Plus Jakarta Sans`)**: Clean, highly readable, humanist geometry optimized for mobile screens. Delivers warm, balanced paragraphs for portrait critique feedback and lighting notes.
3. **Telemetry & Metadata (`JetBrains Mono`)**: Strict, monospaced notation for metadata, EXIF details, ISO/shutter references, score decimals (e.g., `8.7/10`), and scanning status alerts. Rendered uppercase at small scales with deliberate tracking.

## Layout & Spacing

The layout is built around a mobile-first, strict 4-column viewport grid that translates portrait inspection seamlessly across hand-held and tablet contexts:

- **Vertical Rhythm**: Built upon a standard 4px baseline sub-grid with primary jumps of 8px (`space-sm`), 16px (`space-md`), and 24px (`space-lg`).
- **Edge Containment**: Outer canvas margin sits at `1.25rem` (20px) on mobile, ensuring full bleed for image comparison sliders while retaining clean safe-zone gutters for analytical cards.
- **Card Breathing Room**: Complex data sets (e.g., lighting, pose, framing breakdown) enforce a minimum internal padding of `space-md` (16px) with an inter-card gap of `space-md` to avoid visual clustering around high-contrast portrait uploads.

## Elevation & Depth

Visual hierarchy prioritizes surface contrast and crisp outlines over diffuse ambient drops:

- **Ghost Outlines**: Structural surfaces rely on a 1px border (`rgba(226, 232, 240, 0.8)`) rather than heavy shadow envelopes.
- **Micro-Cast Shadows**: Primary floating cards utilize a singular, high-precision shadow: `0 1px 3px rgba(17, 24, 39, 0.04), 0 4px 12px rgba(17, 24, 39, 0.03)`. This grounds the card without muddying the portrait's light tones.
- **Lens Scrim / Overlay**: In scanning and radar review modes, a dark scrim (`rgba(17, 24, 39, 0.65)`) with an `8px` backdrop blur elevates metadata overlays and focal brackets above the subject.
- **Active / Focused Elevation**: Modals and bottom sheets use a crisp top hairline with an elevated elevation tier (`0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)`).

## Shapes

The design system employs a refined curvature scale:

- **Standard Cards & Media Panels**: `rounded-2xl` (1.5rem) softens large analytical modules and full-bleed image viewports, evoking contemporary camera bodies.
- **Badges, Rings & Pill Controls**: Full circular radius (`rounded-full`) is dedicated to score rings, floating camera controls, and filter chips.
- **Inner Micro-Elements**: Nested bars, metric meters, and tooltips follow an interior radius of `0.5rem` to `0.75rem`, preserving visual harmony within outer `rounded-2xl` wrappers.

## Components

### Buttons & Interactive Controls
- **Primary Action (Analyze / Export)**: Solid obsidian charcoal (`#111827`) text in high-contrast white with `Space Grotesk` medium typography. Height `48px`, `rounded-full`, no outer glow, 1px inset border highlight.
- **Secondary Action (Re-crop / Adjust)**: Surface white (`#FFFFFF`) with 1px border (`#E2E8F0`), obsidian text, subtle hover/press fill (`#F9FAFB`).
- **Icon Buttons**: Circular `40x40px` or `48x48px` housings with centered monochrome camera loupe, flash, or crop icons.

### Score Rings & Circular Metrics
- **Overall Score Indicator**: Double concentric circle. Outer ring acts as a light grey track (`#F3F4F6`), inner ring displays vector stroke progress in `#1E40AF`. Center text features the score formatted in `Space Grotesk` (`32px`), accompanied by a sub-label in `JetBrains Mono` (`/ 100`).
- **Dimension Meters**: Horizontal metric tracks for Pose, Lighting, Composition, and Expression. Height `6px`, pill-shaped background well, smooth animated progress fills.

### Cards & Result Modules
- **Portrait Canvas Container**: Edge-to-edge or margin-contained card with `rounded-2xl`, subtle border, displaying dynamic focal bounding boxes (`#1E40AF` dashed lines) over identified portrait features.
- **Critique Feedback Card**: `#FFFFFF` background, `rounded-2xl`, with a subtle category tag (e.g., `LIGHTING RATIO`) positioned top-left in monospaced uppercase.

### State Indicators & Diagnostics
- **Upload / Dropzone**: Dashed outline (`#CBD5E1`), centered minimalist aperture glyph, and dual-tone instructional copy.
- **Analyzing / Radar Scan**: Animated scanning bar moving vertically across the portrait canvas, overlaid with glowing focal points and a monospaced readout (`SCANNING MESH: 84%`).
- **Error / Low-Light State**: Minimalist warning pill (`#FEF2F2` background, `#DC2626` text, hairline border in `#FCA5A5`) with immediate inline remediation advice (e.g., "Subject underexposed. Tap to adjust exposure baseline").

### Chips & Filter Tags
- Height `28px`, `rounded-full`, horizontal padding `12px`. Inactive states feature `#F3F4F6` with `#4B5563` text; selected states adopt deep charcoal (`#111827`) with crisp white typography.