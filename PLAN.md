# Short-Form Video Editor — Feature Set & Architecture Plan

## Context

Build a mobile-first, fully client-side web app for creating short-form video content (YouTube Shorts, Instagram Reels, TikTok). The app is templates-first: users start from trending template formats and customize from there, or switch to a free-edit timeline. It runs offline after the user downloads optional asset packs (fonts, music, SFX, stickers); the app should encourage "Add to Home Screen" on iOS to improve offline reliability, but must also work in regular Safari tabs. Tech stack: React + TypeScript.

### V1 Constraints / Non-Goals

- V1 prioritizes iPhone Safari performance and memory. If a feature risks crashing or multi-minute exports on iPhones, it is deferred.
- No auto-captions / speech-to-text in V1 (no Whisper WASM/model).
- No effects/filters in V1 (no WebGL filter pipeline, no chroma key, no background removal, no speed ramps).
- Avoid multi-video simultaneous playback in V1 (no split-screen reaction template, no secondary video overlays).

---

## V1 Feature Set

### 1. Template System (Primary Experience)

**Trending Format Templates:**

- **Talking Head + Title/Subtitles** — single camera clip, styled text overlays + optional manual subtitle lines.
- **Photo Slideshow** — drop in 3-10 photos, auto-animated (ken burns, zoom, pan) with optional per-slide duration controls
- **Before / After Reveal** — two clips with a simple cut reveal + text labels
- **POV Story** — text overlay ("POV: ...") + clip sequence with dramatic music
- **Text Story / Quote Cards** — series of styled text screens with background clips or gradients
- **Product Showcase** — zoom-in clips with floating text callouts, price tags
- **Countdown / Listicle** — "Top 5..." format with numbered sections and hard cuts

**Template Mechanics:**

- Templates are JSON definitions describing: slot count/types (video, photo, text), durations, cut points, text positions/styles, audio layer config
- Slot-based editing — each template has clearly marked drop zones. Tap a slot → pick media from device
- Smart duration — template auto-adjusts timing to fit user's clips, or user manually trims
- Style variants — each template has 3-5 color/font/mood variants (e.g., "clean", "bold", "vintage", "neon")
- Template preview — animated thumbnail preview before selecting

### 2. Free Edit Mode (Timeline Editor)

Available as an alternative to templates, or as "advanced mode" after applying a template:

- Single video track with multi-layer overlays (text, stickers, images)
- Touch-optimized timeline: pinch-to-zoom, drag handles to trim, long-press to split, drag to reorder
- Bottom-sheet tool panels — all tools accessible via thumb-friendly panels
- Clip operations: trim, split, duplicate, delete, reorder
- 9:16 locked canvas (with 1:1 and 4:5 as secondary options)
- Undo/redo stack — always visible, backed by IndexedDB for persistence
- Frame-accurate scrubbing via thumbnail strip

### 3. Text

- Manual text overlays — add titles, CTAs, labels at any point on timeline
- **Text editing:** font picker (from bundled set), size, color, stroke, shadow, animation in/out
- Optional "subtitle lines" track (manual): add/edit lines with in/out handles, plus a few popular subtitle style presets

### 4. Audio

- Bundled music library (downloadable pack) — royalty-free tracks organized by mood
- Bundled SFX (downloadable pack)
- Simple audio mixing: music track + optional SFX clips
- Volume per track/clip + fade in/out
- (Optional) Voiceover recording via mic, placed on a separate audio layer

### 5. Visual Assets (Bundled)

- Fonts (downloadable pack) — 15-20 fonts covering: clean sans-serif, bold display, handwritten, serif, monospace, decorative. Prioritize fonts popular in short-form content.
- **Sticker/Overlay packs** — arrows, circles, emoji-style reactions, "Subscribe" buttons, social handles frames, progress bars, like/follow CTAs
- **Animated elements** — particle effects, confetti, sparkles, fire, smoke (canvas/WebGL rendered)
- **Background gradients & patterns** — for text card screens

### 6. Export & Share

- Client-side encoding:
  - Primary V1 path: `MediaRecorder` recording a composed `MediaStream` (Canvas capture + mixed WebAudio) to `video/mp4` where supported (iOS Safari targets H.264/AAC MP4).
  - Fallback paths (as needed): WebCodecs-based encode/mux (where fully supported) or FFmpeg.wasm on devices that can handle it.
  - Presets: 1080x1920 @ 30fps (default), 720x1280 option for faster export
  - Platform-specific duration limits shown during editing (60s YouTube, 90s Reels, 10min TikTok)
- **Export quality:** "Quick" (720p, faster encode) and "High" (1080p, slower)
- **Progress bar** with time estimate and cancel option
- **Web Share API** — native share sheet on mobile for direct posting
- **Save to device** — fallback download for desktop browsers
- **Project auto-save** — continuous save to OPFS/IndexedDB, survives tab close

---

## Architecture & Tech Stack

### Core Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 18+ with TypeScript |
| State Management | Zustand (lightweight, works well with complex nested state like timelines) |
| Styling | Tailwind CSS (utility-first, good for responsive mobile-first design) |
| Build Tool | Vite (fast HMR, good WASM/worker support) |
| PWA | Vite PWA plugin + custom Service Worker |

### Media Processing

| Capability | Technology |
|-----------|-----------|
| Video decode | HTMLVideoElement + `requestVideoFrameCallback` (when available); use WebCodecs decode where supported |
| Video encode/export | `MediaRecorder` (primary V1), WebCodecs encode (where supported), FFmpeg.wasm (fallback) |
| Preview composition | Minimal compositor: base video + overlays (Canvas 2D for export; DOM overlays for interactive preview where possible) |
| Audio processing | Web Audio API (mixing, volume, fades) |

### Storage & Offline

| Concern | Approach |
|---------|---------|
| Media files | OPFS (Origin Private File System) — fast, large capacity |
| Project state | IndexedDB via idb wrapper — JSON project definitions |
| Assets (fonts, music, SFX) | Versioned asset packs; explicit in-app download; stored via Cache API and/or OPFS |
| Undo history | In-memory ring buffer + periodic IndexedDB snapshots |
| Offline | Service Worker caches app shell on first load; asset packs are downloaded explicitly and then available offline. No runtime network calls after packs are installed. |
| Persistence | Call `navigator.storage.persist()` and guide users to "Add to Home Screen" on iOS to reduce eviction risk |

### Performance Strategy

- Web Workers for heavy processing (export encoding/mux) — never block the main thread
- OffscreenCanvas (where supported) for export rendering in a worker
- Thumbnail generation pipeline — extract keyframes on import, cache in OPFS
- Lazy initialization — download asset packs only when requested
- requestAnimationFrame loop for smooth preview playback with canvas compositing

---

## Mobile-First UX Principles

- **Bottom navigation bar** — switch between: Templates, Edit, Text, Audio, Export
- **Bottom sheets** — all tool panels slide up from bottom, swipe down to dismiss
- **Thumb zone design** — all primary actions within bottom 60% of screen
- **Gesture vocabulary:**
  - Single tap: select
  - Long press: context menu / split
  - Drag: move/reorder clips
  - Pinch: zoom timeline
  - Swipe handles: trim in/out
  - Two-finger rotate: rotate overlays
- **Haptic feedback** via Vibration API on snap points, trim handle engagement
- **Large touch targets** — minimum 44x44px for all interactive elements
- **Preview takes priority** — video preview occupies top 50-60% of screen, tools below

---

## Template JSON Schema (Conceptual)

```typescript
interface Template {
  id: string;
  name: string;
  category: 'talking-head' | 'slideshow' | 'before-after' | 'pov' | 'reaction' | 'text-story' | 'showcase' | 'listicle';
  duration: { min: number; max: number; default: number };
  aspectRatio: '9:16' | '1:1' | '4:5';
  variants: StyleVariant[];
  slots: Slot[];
  audioConfig: { defaultTrackId?: string };
  cuts?: number[]; // optional cut points in seconds (V1 uses hard cuts only)
}

interface Slot {
  id: string;
  type: 'video' | 'photo' | 'text';
  label: string;              // "Main clip", "B-roll", "Title text"
  position: { x: number; y: number; w: number; h: number }; // normalized 0-1
  timing: { start: number; end: number };
  style?: TextStyle;          // for text slots
  animation?: AnimationPreset;
  required: boolean;
}

interface StyleVariant {
  id: string;
  name: string;               // "Clean", "Bold", "Neon"
  colorPalette: string[];
  fontPrimary: string;
  fontSecondary: string;
  filterPreset?: string;
}
```

---

## Bundled Asset Inventory (Target)

| Category | Count | Est. Size | Format |
|----------|-------|-----------|--------|
| Fonts | 18 | ~15MB | .woff2 |
| Music tracks | 35 | ~100MB | .mp3 (128kbps) |
| Sound effects | 55 | ~10MB | .mp3 |
| Sticker/overlay PNGs | 80 | ~5MB | .webp |
| Animated overlays | 10 | ~3MB | Lottie JSON / sprite sheets |
| **Total** | — | **~133MB** | — |

> **Note:** Progressive loading — app shell + core UI loads fast (<2MB). Users explicitly download asset packs (with progress) and those packs are cached for offline use.

---

## MVP Scope (V1 Milestone Breakdown)

### M0: iPhone Capability Spike (Do This First)

- Test on real devices early: iOS Safari + iOS installed PWA (Add to Home Screen), plus Android Chrome as a sanity check
- Validate preview approach (native video playback + overlays) without jank on iPhones
- Validate export approach with `MediaRecorder` to `video/mp4` from (Canvas capture + mixed WebAudio)
- Validate storage: OPFS + IndexedDB + SW cache, persistence request, and behavior after reload/offline
- Establish V1 limits (e.g., max duration/resolution presets on iPhone)

### M1: Foundation

- React + Vite + PWA scaffolding
- OPFS + IndexedDB storage layer
- Service Worker app-shell caching
- Asset pack framework (manifest types + install records + cache helpers; defer real packs/download UI)
- Media import (camera capture + file picker)
- Basic video preview (native video playback + overlays)
- Project save/load

### M2: Timeline & Basic Editing

- Timeline component (touch-optimized)
- Trim, split, reorder clips
- Undo/redo system
- Thumbnail strip generation

### M3: Template Engine

- Template JSON schema + renderer
- 4 initial templates (talking head, slideshow, before/after, text story)
- Slot-based media assignment
- Style variant system

### M4: Text

- Text overlay system (add, position, style, animate)
- Subtitle lines (manual) + a few popular subtitle style presets
- Font + sticker packs: download/install UI + versioning + offline cache

### M5: Audio

- Bundled music + SFX library
- Volume controls + fades
- (Optional) voiceover recording
- Music + SFX packs: download/install UI + versioning + offline cache

### M6: Export & Polish

- Export pipeline (MediaRecorder primary; fallbacks as needed)
- Export presets (platform-specific)
- Web Share API integration
- Rich asset bundle finalization
- Asset pack upgrades/polish (migrations, eviction handling, storage prompts)

---

## Verification / Testing Strategy

- **Unit tests:** Vitest for state management, template engine, timeline logic
- **Component tests:** React Testing Library for UI components
- **E2E:** Playwright on mobile viewports (iPhone SE, iPhone 14, Pixel 7)
- **Performance benchmarks:** Track preview FPS, export time, memory usage; define "max safe project size" for iPhones
- **Manual testing:** Real device testing on iOS Safari + iOS installed PWA + Android Chrome
- **Lighthouse:** PWA audit, performance scores on mobile
- **Storage testing:** Verify OPFS/IndexedDB limits, graceful handling when full

---

## Deferred (V2+ Backlog)

- Auto-captions / speech-to-text (Whisper WASM + model download)
- Effects/filters (WebGL LUTs), transitions beyond hard cuts, speed ramps
- Background blur fills, chroma key, AI background removal (MediaPipe)
- Beat detection and auto-ducking
- Split-screen reaction template and any multi-video overlays
