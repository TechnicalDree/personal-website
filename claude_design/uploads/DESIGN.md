---
name: Cybernetic Terminal
colors:
  surface: '#0d1515'
  surface-dim: '#0d1515'
  surface-bright: '#333b3b'
  surface-container-lowest: '#081010'
  surface-container-low: '#151d1e'
  surface-container: '#192122'
  surface-container-high: '#232b2c'
  surface-container-highest: '#2e3637'
  on-surface: '#dce4e4'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#dce4e4'
  inverse-on-surface: '#2a3232'
  outline: '#849495'
  outline-variant: '#3a494b'
  surface-tint: '#00dce6'
  primary: '#e3fdff'
  on-primary: '#00373a'
  primary-container: '#00f3ff'
  on-primary-container: '#006b71'
  inverse-primary: '#00696f'
  secondary: '#fface8'
  on-secondary: '#5e0053'
  secondary-container: '#ff24e4'
  on-secondary-container: '#520049'
  tertiary: '#fff9da'
  on-tertiary: '#353100'
  tertiary-container: '#eee000'
  on-tertiary-container: '#696200'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ff6ff'
  primary-fixed-dim: '#00dce6'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f53'
  secondary-fixed: '#ffd7f0'
  secondary-fixed-dim: '#fface8'
  on-secondary-fixed: '#3a0033'
  on-secondary-fixed-variant: '#840076'
  tertiary-fixed: '#f5e700'
  tertiary-fixed-dim: '#d7ca00'
  on-tertiary-fixed: '#1f1c00'
  on-tertiary-fixed-variant: '#4d4800'
  background: '#0d1515'
  on-background: '#dce4e4'
  surface-variant: '#2e3637'
typography:
  h1:
    fontFamily: Space Grotesk
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  h2:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.2'
  h3:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.05em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.2'
spacing:
  unit: 4px
  gutter: 24px
  margin: 48px
  container-max: 1440px
---

## Brand & Style

This design system establishes a high-fidelity "Cyberpunk Retro" aesthetic, merging the grit of 80s hardware interfaces with the precision of modern high-end HUDs. The personality is technical, elite, and slightly subversive, designed to present a portfolio as a secure data terminal.

The style is a hybrid of **Brutalism** and **Glassmorphism**. It utilizes the structural rigidity and heavy borders of brutalist grids, but softens them with the digital depth of glowing overlays and translucent glass layers. The emotional response should be one of "controlled chaos"—highly organized data systems punctuated by volatile neon energy and glitch-inspired interactions.

## Colors

The palette is anchored in deep blacks to maximize the "pop" of the luminous accents. 

- **Backgrounds:** Use `#0A0A0A` for the primary canvas and `#121212` for secondary modules and card surfaces.
- **Accents:** Cyan (`#00F3FF`) serves as the primary action color. Magenta (`#FF00E5`) is reserved for critical highlights and "glitch" offsets. Electric Yellow (`#FFF000`) acts as a warning or secondary data signal.
- **Data Visualization:** Use these high-saturation colors against the dark base to imply light emission, often accompanied by soft Gaussian blurs to simulate a glow effect on hardware screens.

## Typography

This design system utilizes a tiered typography approach to reinforce the HUD aesthetic.

- **Headlines:** Use **Space Grotesk**. These should feel aggressive and architectural. Tighten letter spacing on H1s for a more "designed" look.
- **Body Text:** Use **Inter**. It provides necessary readability amidst the high-contrast environment. Keep line-heights generous to prevent the dark background from swallowing the text.
- **Functional/Data Labels:** Use **JetBrains Mono** (or similar monospaced font). This is the "terminal" voice. Use it for metadata, timestamps, button labels, and small technical details to create a programmed feel.

## Layout & Spacing

The layout philosophy follows a **Fixed 12-Column Grid** reminiscent of technical schematics. 

- **Grid Alignment:** Elements should feel "locked" into position. Use visible grid lines or corner markers (L-brackets) to define the boundaries of the layout.
- **Spacing Rhythm:** Based on a 4px baseline. Use 24px gutters to allow the "neon glow" of borders enough room to breathe without overlapping adjacent content.
- **Modular Blocks:** Content is partitioned into modular units. Large sections should be separated by clear, thin horizontal rules that look like data separators.

## Elevation & Depth

In this design system, depth is conveyed through **Light Emission** and **Transparency** rather than traditional shadows.

- **Stacking:** Use surface color shifts (`#121212` vs `#1A1A1A`) to indicate hierarchy. 
- **The Glow Effect:** Instead of drop shadows, use `box-shadow` with the accent colors (Cyan or Magenta) and high blur (10px–20px) at low opacity (20–30%) to simulate a screen glowing in the dark.
- **Scanlines:** Apply a subtle, fixed-position SVG or CSS linear-gradient overlay across the entire viewport to mimic a CRT monitor.
- **Backdrop Blur:** When using modal overlays or menus, use a high blur (20px) with a semi-transparent dark tint to maintain the HUD feeling.

## Shapes

The design system adopts a **Sharp (0px)** corner philosophy. 

- **Hard Edges:** All buttons, cards, and input fields must have square corners. This reinforces the "hardware" and "industrial" nature of the interface.
- **Beveled Details:** For decorative elements, use 45-degree clipped corners (dog-ears) instead of rounding to evoke a futuristic, military-grade hardware look.

## Components

### Buttons
Primary buttons use a solid Cyan fill with black text. On hover, trigger a "glitch" animation—a rapid horizontal jitter and a momentary color split (Magenta/Cyan). Secondary buttons should be ghost-style with a 1px Cyan border and glowing text.

### Cards
Cards are modular "data pods." They feature a 1px border in a dark neutral (`#2A2A2A`) that turns Cyan on hover. Add decorative monospaced "serial numbers" or "status codes" in the top-right corner of cards to enhance the HUD theme.

### Inputs
Inputs are simple underscored lines or full-box outlines with a blinking "block" cursor. Text entry should feel like typing into a terminal. Use the Electric Yellow for focus states to indicate an "active" data field.

### Glitch Effects
Apply a CSS-based glitch effect to headings and images during state changes or on a slow loop. This involves duplicating the element and offsetting it with Magenta and Cyan color filters.

### Navigation
The navigation should be treated as a "System Menu." Use monospaced labels with prefix icons (e.g., `[01] WORK`, `[02] ABOUT`). Include a small "Active Connection" pulse icon near the brand mark to simulate a live link.