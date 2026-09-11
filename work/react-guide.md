# Together — React photobooth

The approved Together design, migrated to React with TypeScript and Vite. The existing DM Sans typography, responsive styles, artwork, animations, and separate booth steps are preserved.

## Start here

Use Node.js 24 LTS and pnpm 10.11.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local address printed by Vite. From the parent project folder, `./start-preview.ps1` starts the same preview using the bundled Node runtime if needed. Keep it running while viewing the website.

```sh
pnpm build    # Check TypeScript and produce the dist folder
pnpm test     # Check timing, limits, retakes, filters and export geometry
pnpm preview # Serve the production build locally
```

## How the app fits together

- `src/main.tsx` mounts React and imports the original styles.
- `src/App.tsx` handles the existing hash navigation between home, About and the booth.
- `src/pages/` holds the landing and About pages.
- `src/components/` holds the animated sample strips and instructions dialog.
- `src/booth/Booth.tsx` owns the current step, layout, selected design and captured photos.
- `LayoutScreen`, `DesignScreen`, `SessionScreen` and `EditScreen` render one step at a time.
- `PhotoTray.tsx` handles mouse/touch reordering, keyboard arrow controls and retake selection.
- `capture.js` runs a cancellable capture sequence independently of React.
- `core.js` contains the reusable layout definitions, filters and photo-array operations.
- `designs.ts` describes the artwork crop and photo positions for each custom design.
- `renderCard.js` uses the existing Canvas rendering logic for both preview and export.
- `src/styles/` holds the original styles with the print selectors adjusted for React.
- `public/` contains the supplied artwork and sample portraits, served at `/filename`.

The UI is TypeScript. The existing image-processing code remains in small JavaScript modules so its tested behavior can be reused without rewriting it at the same time.

## Current experience

Instructions → layout → design → photos → review and export.

The picker offers A, B, C, D, E, G, H and K. Layout A has nine supplied three-photo designs plus Classic; other layouts use Classic for now. Four-photo templates and Clapper Filmstrip remain excluded. Each session takes only the number of photos its layout needs.

Capture supports sample portraits or a solo webcam, manual clicks or a 3/5/7-second countdown, reordering, and individual retakes. Stopping a countdown preserves completed photos. Cancelling or failing a retake preserves the previous photo. Leaving the session stops camera tracks and ignores late capture/permission results.

Review offers Original, Vivid, Vintage with Grain, Cool, Yellow and B&W. Classic frames also have four colors and an editable caption. Supplied artwork retains its printed text. PNG/JPG download and print use the same renderer as the preview.

Classic cards use the layout's 300-pixel-per-inch dimensions. Custom artwork exports use the artwork's cropped aspect ratio, avoiding added top/bottom margins; they are not forced to exactly 2 × 6 inches. Printer margins are controlled by the print dialog.

Photos and edits stay in memory in the current tab and reset on refresh. Shared invitation rooms, two-person webcam connections and synchronized remote capture are not implemented yet.

## Learning this migration

Start with `LayoutScreen.tsx`: it receives the selected layout and calls a parent callback when you choose another one. `Booth.tsx` updates state, and React redraws the screen. This replaces building HTML strings and manually attaching click handlers.

Then read `SessionScreen.tsx`: effects clean up camera resources, while refs track in-flight work without triggering a redraw. The capture controller uses an abort signal so leaving or stopping cannot insert an unwanted late photo.

The original prototype source is backed up in `../work/prototype-before-react/`. The website's existing Git history and Sites project configuration are retained. Nothing in this migration adds a backend or publishes the site to a new audience.

## Verification

TypeScript and the production build must pass. The Node tests cover the actual shared capture controller, layout bounds, immutable photo operations, six filters and all nine custom exports' crop/draw geometry. These are logic checks with mocked Canvas calls; real camera permissions, actual printer output and visual behavior across devices still need browser testing.
