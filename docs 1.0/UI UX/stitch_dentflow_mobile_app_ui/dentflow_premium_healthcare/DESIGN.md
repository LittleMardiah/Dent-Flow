---
name: DentFlow Premium Healthcare
colors:
  surface: '#fff8f8'
  surface-dim: '#e6d6d9'
  surface-bright: '#fff8f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff0f2'
  surface-container: '#fbeaec'
  surface-container-high: '#f5e4e7'
  surface-container-highest: '#efdfe1'
  on-surface: '#22191b'
  on-surface-variant: '#534342'
  inverse-surface: '#372e30'
  inverse-on-surface: '#feedef'
  outline: '#867372'
  outline-variant: '#d8c1c0'
  surface-tint: '#8f4a4b'
  primary: '#8f4a4b'
  on-primary: '#ffffff'
  primary-container: '#d08080'
  on-primary-container: '#531c1e'
  inverse-primary: '#ffb3b2'
  secondary: '#705959'
  on-secondary: '#ffffff'
  secondary-container: '#f8d8d8'
  on-secondary-container: '#755d5d'
  tertiary: '#964646'
  on-tertiary: '#ffffff'
  tertiary-container: '#d97b7a'
  on-tertiary-container: '#58171a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad9'
  primary-fixed-dim: '#ffb3b2'
  on-primary-fixed: '#3a090d'
  on-primary-fixed-variant: '#723335'
  secondary-fixed: '#fbdbdb'
  secondary-fixed-dim: '#debfbf'
  on-secondary-fixed: '#281717'
  on-secondary-fixed-variant: '#574142'
  tertiary-fixed: '#ffdad8'
  tertiary-fixed-dim: '#ffb3b1'
  on-tertiary-fixed: '#3e0409'
  on-tertiary-fixed-variant: '#782f30'
  background: '#fff8f8'
  on-background: '#22191b'
  surface-variant: '#efdfe1'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 42px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: '0'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: '0'
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes a warm, premium clinical aesthetic tailored for high-end dental and healthcare management. It merges clinical precision with the hospitality and comfort of a boutique wellness retreat, directly countering clinical anxiety.

### Philosophy & Visual Tone
- **Atmospheric Warmth**: Moves away from sterile blues and clinical whites in favor of restorative, humanizing blush tones, alabaster surfaces, and muted warm charcoals.
- **Boutique Luxury**: Interfaces feel quiet, airy, and deliberate. Generous negative space, refined typography, and whisper-soft borders convey exclusivity and meticulous care.
- **Tactile Reassurance**: Micro-elevations with rose-tinted diffusion create tangible hierarchy without jarring visual clutter, reassuring patients and clinical staff alike.

## Colors

The palette is engineered around warm rose tones calibrated for visual serenity, high contrast, and accessible legibility.

### Palette Architecture
- **Primary Rose (`#D08080`)**: Core brand accent; drives key interactive targets, vital indicators, and focal selections.
- **Primary Light (`#F5D5D5`)**: Soft wash for secondary badges, selected state fills, and calm background accents.
- **Primary Dark (`#A85454`)**: High-contrast interactive states (pressed/hover), critical contextual badges, and focused accents.
- **Background Base (`#FFF8F7`)**: Radiant, porcelain canvas that eliminates harsh screen glare while sustaining a gentle warmth.
- **Surface Layer (`#FFFFFF`)**: Pure floating cards, bottom sheets, and grouped view panels.
- **Text Primary (`#2D2426`)**: Deep warm espresso-charcoal replacing pure black for gentle readability.
- **Text Muted (`#827072`)**: Balanced secondary tone for subheadings, metadata, timestamps, and input placeholders.
- **Borders & Dividers (`#F0E0E0`)**: Structural framing borders delivering subtle boundary clarity.

### Functional Gradients
- **Rose Radiance (Hero / Featured Cards)**: Linear gradient from `#D08080` to `#A85454` at an angle of 135deg, providing depth to primary action triggers and procedure summaries.
- **Blush Whisper (Surface Highlights)**: Linear gradient from `#FFFFFF` to `#FFF0EF` at 180deg for elevated status cards and calendar schedule heads.

## Typography

The typography uses **Plus Jakarta Sans** throughout all tiers to maintain balanced geometric proportions, open apertures, and an authoritative yet welcoming tone.

### Application Rules
- **Display & Large Headlines**: Reserved for welcome banners, key metrics (e.g., patient adherence, treatment progress), and calendar day views. Use bold weight with tight negative letter tracking to retain structure.
- **Headlines (Medium & Small)**: Apply to card grouping titles, doctor profile names, and appointment breakdown headers.
- **Body Hierarchy**: `body-lg` supports patient consultation notes and medical intake copy; `body-md` acts as standard interface body copy; `body-sm` styles descriptive helper texts and secondary item specifics.
- **Labels & Micro-copy**: Render button CTAs, navigation tabs, status chips, and tooth chart markers in semi-bold weights (`label-lg` through `label-sm`) with deliberate tracking to safeguard mobile readability.

## Layout & Spacing

A compact, fluid layout system constructed for mobile-first clinical operations, scaling reliably into tablet and split-pane operator views.

### Screen Adaptation
- **Mobile (Base)**: Single-column canvas using an outer margin of `1.25rem` (20px) and element gutters of `1rem` (16px). Touch targets adhere strictly to a minimum 44px boundary.
- **Tablet / Clinical Chairside View**: 6-column fluid grid, increasing the outer canvas margin to `2rem` (32px), enabling split-view consultations (e.g., patient odontogram chart on the left, procedural timeline on the right).
- **Desktop Dashboard**: 12-column layout with capped container widths (1200px), reserving persistent navigation rails and elevated tool docks.

### Spacing Scale
- `space-xs` (4px): Icon-to-text offsets, micro tag padding, inline status dots.
- `space-sm` (8px): Dense group spacing, pill paddings, input icon insets.
- `space-md` (16px): Standard component internal padding, stack spacing between form controls.
- `space-lg` (24px): Card module padding, section separations.
- `space-xl` (32px): Primary view group separators, dashboard segment dividers.

## Elevation & Depth

Visual hierarchy uses warm, diffuse ambient illumination rather than generic neutral drop-shadows, creating soft, tactile physical planes.

### Shadow Architecture
- **Elevation 0 (Flush)**: Neutral state (`#FFFFFF` or `#FFF8F7`) paired with a `1px` continuous border in `#F0E0E0`. Used for data fields, unselected list rows, and structural divisions.
- **Elevation 1 (Card & Module)**: `0 4px 16px -2px rgba(208, 128, 128, 0.10)`. Applied to standard appointment cards, patient profile summaries, and interactive tiles.
- **Elevation 2 (Floating & Active Interaction)**: `0 8px 24px -4px rgba(208, 128, 128, 0.16)`. Applied to active navigation bars, drawer handles, filter sheets, and selected treatments.
- **Elevation 3 (Modal & Sheet Overlay)**: `0 16px 36px -6px rgba(168, 84, 84, 0.22)`. Applied to urgent booking confirmation sheets, tooth history popovers, and dialogs.

### Surface Treatment
Card surfaces use white (`#FFFFFF`) framed by fine hair-line borders (`#F0E0E0`) to retain strict clarity when stacked over the `#FFF8F7` canvas.

## Shapes

The shape system pairs rounded containers with pill-shaped interactive anchors to balance structure and comfort.

### Corner Radius Standards
- **Containers & Cards (`12px` to `16px`)**: Standard patient tiles, treatment cards, calendar day cells, and bottom sheet containers utilize a radius of `12px` (`rounded-md`) to `16px` (`rounded-lg`).
- **Pills (`9999px`)**: Interactive tags, doctor specialization chips, triage urgency pills, quick-filter chips, and floating action indicators.
- **Input Fields & Form Fields (`12px`)**: Gentle rounded corners providing comfortable touch areas while preserving form discipline.

## Components

### Buttons
- **Primary CTA**: Filled with the Rose Radiance gradient or solid `#D08080`, `#FFFFFF` typography (`label-lg`), height 50px, border-radius 14px. Hover/Press shifts background to `#A85454` with a scale down to `0.985` for tactile feedback.
- **Secondary Action**: Background `#F5D5D5`, `#A85454` typography, no border. Transitions to `#F0C4C4` on touch.
- **Ghost/Tertiary**: Background transparent, `#D08080` text, paired with subtle border `#F0E0E0` on active states.

### Chips & Badges
- **Status Pills**: Height 28px, full rounded pill shape.
  - *Confirmed / Healthy*: Background `#EAF7EE`, text `#2A7E4B`.
  - *Upcoming / Routine*: Background `#F5D5D5`, text `#A85454`.
  - *Attention / Urgent*: Background `#FDEEEE`, text `#C93B3B`.
- **Filter Chips**: Height 36px, border `1px solid #F0E0E0`, surface `#FFFFFF`. When selected, fills with `#D08080` and displays text in `#FFFFFF`.

### Input Fields
- Enclosed containers with a 50px height, background `#FFFFFF`, border `1px solid #F0E0E0`, and border-radius `12px`.
- Left-aligned icons tinted in `#827072`.
- Focus state: Border transitions to `#D08080` with a 3px outer glow ring of `rgba(208, 128, 128, 0.20)`.

### Cards & Appointment Panels
- Background `#FFFFFF`, border-radius `16px`, bordered with `#F0E0E0`, backed by Elevation 1 shadow.
- Header showcases dentist avatar (circle or 12px squircle), clinician name (`headline-sm`), clinic suite, and status pill right-aligned.
- Footer features quick actions (Reschedule, Directions) separated by a clean hairline divider.

### Odontogram (Interactive Tooth Chart) Components
- Anatomical tooth modules arranged symmetrically.
- Base condition: Fill `#FFFFFF`, outline `#F0E0E0`.
- Selected/Treated condition: Fill `#F5D5D5`, stroke `#D08080` with 2px weight.
- Pathology Flag: Accent indicator dot in `#A85454`.

### Shimmer Loading Skeletons
- Surface fill `#F5ECEB` modulated by an animated linear highlight gradient sweeping from `#F5ECEB` to `#FFFFFF` to `#F5ECEB` at an angle of 90deg, reflecting soft, natural luminescence during data retrieval.