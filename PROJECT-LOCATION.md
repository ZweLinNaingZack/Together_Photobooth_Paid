# Online photobooth

This folder is now the home for the whole project.

- `website/`: current working website, public assets, tests, build output, and its original Git history.
- `website/src/`: React screens, reusable components, photo logic, and styles.
- `work/prototype-before-react/`: backup of the original prototype before migration.
- `Photocard designs/`: collected design references.
- `templates/`: generated artwork and layout templates.
- `sample-photocard-desgin-all/`: supplied per-layout sample artwork.
- `work/`: intermediate scripts and checks from recent work.
- `work/prototype-original/`: scratch work and the deployment archive from the old project location.

Run `./start-preview.ps1` in PowerShell to start the preview, then open http://127.0.0.1:5173/ . Keep that process running while viewing the site.

The website and this enclosing asset workspace retain their existing separate Git histories. No history was discarded or merged during consolidation.

Historical scripts inside `work/` may refer to the old project path; they are retained as records and should not be rerun without updating their paths. Active website source is in `website/`.
