# TIER 7: Next.js + Three.js Audit (hero-market)

## Phase 1 — SSR / Window Guards

### ✅ OasisWorldPage.tsx
- **resolveModelUrl**: Has `typeof window !== "undefined"` guard before `window.location.origin`
- **Preload useEffect**: Uses `typeof window !== "undefined"` and only runs when `isHubSpace`
- **createPortal(el, document.body)**: Component is loaded via `dynamic(..., { ssr: false })`, so never runs on server
- **Keydown listener**: Inside `useEffect` – client-only

### ⚠️ Other files
Most `window`/`document`/`navigator` usages are inside `useEffect`, event handlers, or optional chaining. Client components with "use client" are pre-rendered on server for streaming – any sync access to `window` during render could throw. Audit each.

---

## Phase 2 — Dynamic Imports

| Component | Page | Dynamic? | SSR |
|-----------|------|----------|-----|
| OasisWorldPage | oasis-world/page.tsx | ✅ Yes | ssr: false |
| OasisWorldSceneViewer | oasis-world/[worldId]/page.tsx | ✅ Yes | ssr: false |
| ModelingCanvas | modeling/page.tsx | ✅ Yes | ssr: false |
| AdminElementPreviewCard, GlbPreview, LibraryElementEditor | oasis-elements/page.tsx | ✅ Yes | ssr: false |
| LandingParticleCloud, LandingParticleBackground | page.tsx | ✅ Yes | dynamic |
| TrooVideoMeeting | meet/page.tsx | ✅ Yes | ssr: false |

**Status**: All Three.js/Canvas components use dynamic import with ssr: false.

---

## Phase 3 — Animation Loop / Canvas

hero-market uses **@react-three/fiber** – no manual `requestAnimationFrame` loop. R3F Canvas manages its own render loop. No changes needed for Prompts 3–4.

---

## Phase 4 — GLB / Asset Loading

### ✅ Asset paths
- Nexus Tower: `/models/nexus-tower/modern_building.glb`
- Meridian Tower: `/models/meridian-tower/modern_building.glb`
- Files in `public/models/` – correct for Next.js static assets

### ✅ Loader
- Uses `useGLTF` from `@react-three/drei` (not raw GLTFLoader)
- Drei's `useGLTF` uses Three.js GLTFLoader internally
- No `GLTFLoader` import in hero-market codebase

### package.json
- `three`: ^0.182.0 ✅
- `@react-three/drei`, `@react-three/fiber` ✅

---

## Phase 5 — tRPC / Backend

hero-market **main app does not use tRPC**. The `besu-bundle` folder contains tRPC procedures but appears to be legacy/optional. No `/api/trpc` route in the main app.

---

## Phase 6 — next.config.ts

**Status**: ✅ `transpilePackages: ['three']` added for ESM/Webpack compatibility.
- **Turbopack**: Removed for Vercel compatibility (WASM build issues in some environments).

---

## Phase 7 — Building Visibility (Prompts 18–22)

### ✅ Applied
1. **groundAndScaleScene()**: Grounds GLB so base sits at y=0; scales up if model &lt; 5 units.
2. **Lights**: `ambientLight` 1.5, `directionalLight` 2.5, `hemisphereLight` 0.8.
3. **Camera**: Hub space `[0, 28, 40]` looking down at center.

### GLB paths (verified)
- `public/models/nexus-tower/modern_building.glb` ✅ (9-floor office from Nexus Tower project)
- `public/models/meridian-tower/meridian_tower.glb` ✅ (procedural 2-floor from Meridian; run `npm run export:meridian-tower` to regenerate)
- `.gitignore` does not exclude `*.glb` or `public/models/` ✅

---

## Fixes Applied (Verified)

1. ✅ `transpilePackages: ['three']` in next.config.ts
2. ✅ Turbopack config removed for Vercel
3. ✅ ModelingCanvas: dynamic import with ssr: false (modeling/page.tsx)
4. ✅ AdminElementPreviewCard, GlbPreview, LibraryElementEditor: dynamic import with ssr: false (oasis-elements/page.tsx)
5. ✅ ElementModel grounding + scale fix for GLB placement
6. ✅ Scene lighting and camera for hub buildings
7. ✅ Hub placements: always seeded by placements API (even when elements not yet seeded); elementId nullable
8. ✅ ElementModel: broader geometry check (Mesh/Line/Points); debug box fallback when GLB has no renderables; dev console logs for `/models/` paths
9. ✅ PBR materials: faint emissive (color + 0.12 intensity) so hub buildings don't render black
10. ✅ Meridian Tower: unique procedural GLB (meridian_tower.glb), not shared with Nexus

---

## Hub Buildings (Nexus & Meridian)

- **Nexus Tower**: 9-floor GLB from `modern_building.glb` (Nexus source project)
- **Meridian Tower**: Procedural 2-floor building exported via `npm run export:meridian-tower` → `meridian_tower.glb` (unique model, not shared with Nexus)
- Both use `MeshStandardMaterial` with emissive fallback for visibility without env map

---

## Troubleshooting: Buildings Not Visible

If Nexus/Meridian Towers or other placed models show labels but no 3D:

1. **Dev console**: Look for `[ElementModel] /models/... { hasScene, hasRenderables }` – confirms load status.
2. **Fallbacks**: Magenta box = Suspense (loading); orange = ErrorBoundary (useGLTF error); green wireframe = GLB loaded but no geometry; red wireframe = no scene (404).
3. **Network tab**: Filter for `.glb` – 404 means asset missing (check Vercel deploy includes `public/models/`).
4. **Commit GLBs**: Ensure `public/models/nexus-tower/` and `public/models/meridian-tower/` are in git and deployed.
5. **Meridian Tower**: Regenerate with `npm run export:meridian-tower` if needed.
