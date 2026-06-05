# open-mesh-CAM

A browser-based 3D mesh inspection tool for STL files. Load a model, visualize its geometry, analyze its properties, and slice it along any axis — all in real time with no backend required.

## What it does

open-mesh-CAM lets you load an STL file and interactively inspect it before manufacturing. The main use cases are:

- Verifying mesh geometry and surface quality
- Measuring surface area, volume, and bounding box dimensions
- Identifying sharp edges and discontinuities using threshold-based edge detection
- Generating cross-sectional slice contours along X, Y, or Z axes
- Clicking any triangle to read its exact vertices, normal, and area

## Features

### Model loading
- Drag-and-drop or file-picker upload for binary and ASCII STL files
- Two built-in demo models (torus knot and sphere) load instantly

### Visualization modes
| Mode | Description |
|---|---|
| Mesh + Edges | Solid surface with overlaid edge lines |
| Edges Only | Wireframe only |
| Mesh Only | Solid surface, no edges |

### Edge display
- **All edges** — every triangle edge rendered as a wireframe
- **Smart edges** — only edges where adjacent faces meet at an angle above a configurable threshold (1–90°), useful for spotting features and sharp transitions

### Slicing
Slice the model with evenly spaced parallel planes along X, Y, or Z. Each slice intersection is drawn as a red contour line on the model.

### Triangle inspector
Click any visible triangle to see:
- Face index
- Vertex coordinates A, B, C
- Surface normal
- Triangle area

The selected triangle is highlighted in green.

### Mesh analytics
Automatically computed when a model is loaded:
- Format (binary or ASCII)
- Triangle count
- Surface area (mm²)
- Volume (mm³)
- Bounding box dimensions (mm)

### Viewport controls
- Orbit, pan, and zoom with mouse
- Auto-rotation toggle
- Floor grid toggle
- Studio shadow lighting toggle
- Camera reset and model-center buttons
- Custom color pickers for mesh surface, edges, and background

## Tech stack

| Layer | Technology |
|---|---|
| 3D rendering | Three.js (WebGL) |
| UI / styling | Tailwind CSS v4 |
| Icons | Lucide |
| Build | Vite |
| Language | Vanilla JavaScript (ES modules) |

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in a browser. A demo model loads automatically.

To build for production:

```bash
npm run build
```

Output goes to `dist/`.

## Project structure

```
src/
  main.js          # entry point, event wiring
  app.css          # global styles
  js/
    state.js       # shared application state
    scene.js       # Three.js scene, camera, lights, animation loop
    renderer.js    # mesh/wireframe/edge display and updates
    stl-parser.js  # binary and ASCII STL file parsing
    stl-export.js  # STL generation (used for demo models)
    slicing.js     # cross-section plane intersection
    raycaster.js   # mouse picking and triangle selection
    analytics.js   # surface area, volume, bounding box
    ui.js          # notifications, mode buttons, UI helpers
public/
  models/          # bundled demo STL files
```
