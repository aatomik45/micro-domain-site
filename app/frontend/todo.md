# Tabletop RPG Domain Manager — MVP

## Design Guidelines

### Design References
- Inspired by old parchment/manuscript aesthetics, but rendered in a modern minimal way
- Think: dark academia meets clean web design

### Color Palette
- Background: #0F0F0F (near black)
- Surface/Card: #1A1A1A (dark charcoal)
- Border: #2A2A2A (subtle separator)
- Accent: #C4A882 (warm gold/parchment)
- Text Primary: #E8E0D4 (warm off-white)
- Text Secondary: #8A8078 (muted warm gray)
- Input Background: #141414
- Input Focus Border: #C4A882

### Typography
- Headings: Cormorant Garamond (serif) — elegant, fantasy-inspired
- Body/Labels: Inter (sans-serif) — clean, modern readability
- Heading sizes: Page title 36px, Section titles 20px
- Label: 13px uppercase tracking-wide
- Input text: 16px

### Key Component Styles
- Inputs: Dark background, subtle bottom border, warm gold focus ring
- Sections: Separated by thin horizontal rules or generous spacing
- No heavy cards — use whitespace and typography for hierarchy
- Number inputs styled consistently with text inputs

### Layout
- Single centered column, max-width ~480px
- Generous vertical spacing between sections (48px)
- Subtle fade-in animation on load

### Images
- No images needed — pure typographic design

---

## Development Tasks

1. **Update index.html** — Set title, add Google Fonts (Cormorant Garamond)
2. **Create Index.tsx** — Single page with the domain manager form
   - Domain section: domain name text input
   - Domain Ruler section: name text input + Law & Society skill number input
   - High Magistrate section: name text input + Law & Society skill number input
3. **Update index.css** — Add custom font imports and subtle global styles