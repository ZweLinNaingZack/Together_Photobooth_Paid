from pathlib import Path
import shutil, hashlib
root=Path(__file__).resolve().parents[1]
site=(root/'website').resolve()
backup=(root/'work/prototype-before-react').resolve()
css=site/'src/styles/booth-flow.css'
text=css.read_text(encoding='utf-8').replace('body>main{display:block!important}', 'body>#root{display:block!important}#root>*{display:none!important}#root>main{display:block!important}')
css.write_text(text,encoding='utf-8')
# Remove only replaced files after verifying an identical backup.
names=['app.js','booth-core.js','booth-flow.js','booth-flow.css','style.css','server.mjs','build.mjs','tests/booth.test.cjs']
for name in names:
    old=(site/name).resolve()
    if not old.is_relative_to(site): raise RuntimeError('Outside website')
    if not old.exists(): continue
    saved=backup/name
    saved.parent.mkdir(parents=True,exist_ok=True)
    if not saved.exists(): shutil.copy2(old,saved)
    if hashlib.sha256(old.read_bytes()).digest()!=hashlib.sha256(saved.read_bytes()).digest(): raise RuntimeError('Backup mismatch: '+name)
    old.unlink()
shutil.copy2(root/'work/react-guide.md',site/'README.md')
print('Archived replaced entrypoints; adjusted print styles and documentation.')
