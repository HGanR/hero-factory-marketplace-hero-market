# Stadium ticker and public camera constraints

Production baseline: recovery-from-prod at 3e9a80c86c9be135aeece1fe2ec5dac04ca3348d,
confirmed by the current READY Vercel production deployment. The editor and
public /troo-town share GreenTerrainExperience and the saved Green Terrain layout.

## Findings

The checked-in GLB has Bowl_Wall outer radius 72, y 0..28; Roof_Ring reaches
radius 71, y 27..33. The previous signage cylinder used radius 41 at y26: it was
inside the shell. Its text was TROO STADIUM, repeated five times in a 2048px
texture with no per-repeat text width limit. The separate baked-in Ticker_Board
is a flat interior board; it is not the scrolling exterior band.

WorldFirstPersonControls only clamped terrain X/Z and forced eye height. It had
no exterior collision volumes. OrbitControls only restricted zoom and polar
angle. Interior FirstPersonControls had some collision boxes, which did not
apply to either exterior mode.

## Repair

Measure actual shell vertices through their model transforms; position the band
1.5 local units outside their maximum horizontal radius. Scaling/rotation follow
the same parent placement as the stadium. Text is TROOTHHURTZ STADIUM, four
bounded repeats on a 4096×64 texture wrapped twice around the band to keep letter proportions readable. Scroll continues outside without requiring
Enter Stadium. Normal depth testing remains enabled; no render-order trick hides
the original geometry.

Tag built-in/imported building groups and solid bench/lightpost, tree-trunk and
rock meshes. Gather their transformed world bounds, ignoring invisible models.
A shared exterior camera guard runs after outdoor movement and orbit updates.
It sweeps the entire attempted movement against bounds expanded by 0.65-unit
clearance, stops and slides, and recovers a camera already enclosed when a model
loads or a visitor switches modes. Walking checks the body below the eye so low
objects block too. Long frames are capped for outdoor walk speed. Recompute
bounds every 250ms to pick up asynchronous models and saved presentation edits.

These are conservative world-axis-aligned exterior bounds, not detailed rigid-
body mesh physics. Rotated/irregular building corners and open stadium courtyards
are intentionally blocked as part of the exterior building volume. Use the
existing Enter Building action to enter an interior; that transition and interior
controls/elevators bypass this exterior guard. Editor drag mode is unconstrained.
Roads, water surfaces, sky, labels, ambient NPCs and sidewalks are not solid.
Existing layout overlaps are not automatically repositioned or written back.

## Verification scope

Automated checks exercise swept long-step collision, wall sliding, low obstacles,
roof clearance, mode-switch recovery, overlapping bounds, movement away and
repeated steps. A real GLTFLoader reads the actual model in CI; the production
Stadium component is invoked with hooked render dependencies to assert outside
radius, exact text, bounded text repeats and exterior scroll. The actual shared camera hook is exercised for zoom, walking recovery and explicit interior bypass. Real Three.js bounds
are checked after translation, rotation, resizing and hiding. Shared editor/public
source graph compilation and strict geometry/collision helper types are checked.

Browser visual acceptance remains necessary: inspect the ticker from all sides,
wheel/touch zoom and pan against every saved building, sprint towards walls,
walk around a bench, switch orbit/walk near buildings, and verify explicit Enter/
Exit and Veritas's existing external-tab destination. No live saved layout write,
merge, deployment or production activation is included in this draft.

## Visual follow-up after Charles's screenshot
The first exact-component WebGL browser render did show the exterior ticker.
The screenshot with no ticker cannot establish which URL/build was being viewed.
The old preview was independently confirmed READY at its pinned head; a fresh
link must be used after this repair.

The actual GLB has all 128 Bowl_Wall triangles and all 1024 Roof_Ring triangles
wound opposite their supplied outward normals, with single-sided materials.
Cloned shell geometries now reverse their index winding; cached GLTF geometry and
materials remain intact. An explicit annular seating canopy now spans radii
32..71 at y30, leaving the central arena open. The original Roof_Ring was a
6-unit-wide torus, not a seating roof surface. The ticker uses an unlit sRGB
texture material for readable text independent of scene lights and exposure.

An actual-component WebGL fixture (actual GLB, canvas text, materials and frame
callback; mocked React mount hooks) captures overview, street and opposite views
in CI. These isolated views do not certify the live saved-town route.
