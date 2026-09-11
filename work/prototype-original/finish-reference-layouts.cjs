const fs=require('fs'),root='outputs/together/';
let html=fs.readFileSync(root+'index.html','utf8');
html=html.replace('<script src="booth-flow.js" defer></script>','<script src="booth-core.js" defer></script><script src="booth-flow.js" defer></script>');
html=html.replace('Choose two, four, or six photos. We’ll make room for every moment.','Choose from eleven 2 × 6 and 4 × 6-inch layouts, including landscape cards. Each layout sets the number of photos.');
html=html.replace('There’s a three-second countdown before each shot.','Choose manual capture or a 3, 5, or 7-second timer.');
html=html.replace('After the session, choose a frame, color, and filter. Then download or print your card.','Reorder your photos or retake just one. Then choose a frame, color, and filter before downloading or printing.');
fs.writeFileSync(root+'index.html',html);
let build=fs.readFileSync(root+'build.mjs','utf8').replace("'booth-flow.js'","'booth-core.js','booth-flow.js'");fs.writeFileSync(root+'build.mjs',build);
let flow=fs.readFileSync(root+'booth-flow.js','utf8');
flow=flow.replace("if(state.step!=='session')showStep('session');else sessionScreen();", "const restoreCamera=state.step==='edit'&&state.returnToCamera;if(state.step!=='session')showStep('session');else sessionScreen();if(restoreCamera)toggleCamera();");
flow=flow.replace("if(complete()){stopCamera();state.retake=null;showStep('edit')}","if(complete()){state.returnToCamera=state.mode==='camera';stopCamera();state.retake=null;showStep('edit')}");
fs.writeFileSync(root+'booth-flow.js',flow);
fs.appendFileSync(root+'booth-flow.css',`
/* Reference layouts keep their actual card ratio, including asymmetric photo slots. */
.reference-picker{grid-template-columns:repeat(4,minmax(0,1fr));max-width:1150px;gap:18px}
.reference-picker .layout-choice{min-height:295px;padding:22px 12px;align-items:center;justify-content:flex-start}
.reference-picker .mini-stage{height:155px;width:100%;display:flex;align-items:center;justify-content:center}
.reference-mini{position:relative;display:block;background:#252a27;box-shadow:3px 6px 10px #25282322;flex-shrink:0}
.reference-mini.narrow{height:150px;width:50px}.reference-mini.portrait{height:150px;width:100px}.reference-mini.landscape{height:100px;width:150px}
.reference-mini i{position:absolute;display:grid;place-items:center;background:#fcfaf4;font:12px var(--sans);color:#929a8b;font-style:normal}
.reference-picker .layout-choice>strong{font-size:27px;margin:15px 0 5px}.reference-picker .layout-choice>small{font-size:12px;line-height:1.5;color:var(--muted);margin-top:8px;text-align:center}
.capture-settings{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:20px 0;margin:20px 0}
.capture-settings fieldset{border:0;padding:0;margin:0}.capture-settings legend,.timer-setting{font-size:12px;letter-spacing:1px;font-weight:550}.capture-settings legend{margin-bottom:13px}.capture-settings fieldset label{font-size:14px;display:inline-flex;gap:8px;align-items:center;margin:0 15px 5px 0}.capture-settings input{width:auto;accent-color:var(--red)}
.timer-setting{display:flex;flex-direction:column;gap:10px}.timer-setting select{padding:9px 14px;font-size:14px;border:1px solid #b9c0ae;border-radius:5px;background:var(--paper);letter-spacing:0}
.photo-review{max-width:1050px;margin:30px auto 0;border-top:1px solid var(--line);padding-top:24px}.review-heading{display:flex;align-items:center;justify-content:space-between}.review-heading strong{font:30px var(--serif)}.review-heading>span{font-size:14px;color:var(--muted)}.photo-review>p{font-size:14px;line-height:1.65;color:var(--muted);margin:10px 0 18px}
.review-photos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.review-photo{min-width:0;border:1px solid #c7cdbe;background:var(--paper);padding:7px;border-radius:6px}.review-photo[draggable=true]{cursor:grab}.review-photo.selected-retake,.review-photo.drop-target{outline:2px solid var(--red);outline-offset:2px}.review-photo.dragging{opacity:.5}
.review-image{aspect-ratio:3/2;background:#dbe0d3;position:relative;display:grid;place-items:center;overflow:hidden;border-radius:3px}.review-image>span{font:35px var(--serif);color:#8d987f}.review-image img{width:100%;height:100%;object-fit:cover}.review-image>b{position:absolute;bottom:5px;left:5px;border-radius:50%;width:23px;height:23px;background:var(--paper);display:grid;place-items:center;font:12px var(--sans)}
.reorder-controls{display:flex;justify-content:space-between;margin-top:6px}.reorder-controls button{border:0;background:none;min-width:34px;min-height:34px;border-radius:4px}.reorder-controls button:hover:not(:disabled){background:#e5e9dd}.drag-handle{touch-action:none;cursor:grab;font-size:22px}.reorder-controls button:disabled{opacity:.3;cursor:default}.retake-button{font-size:12px;border:1px solid #c7cdbe;border-radius:4px;background:transparent;width:100%;padding:9px 3px;margin-top:5px}.retake-button:hover{color:var(--red);border-color:var(--red)}.empty-photo-label{display:block;text-align:center;font-size:12px;color:var(--muted);padding:12px 0}
@media(max-width:1000px){.reference-picker{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:650px){.reference-picker{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.reference-picker .layout-choice{min-height:275px;padding:18px 8px}.reference-mini.landscape{width:132px;height:88px}.reference-picker .layout-choice>span:not(.layout-check){font-size:12px}.capture-settings{flex-direction:column;align-items:flex-start}.timer-setting{width:100%}.review-photos{grid-template-columns:repeat(2,minmax(0,1fr))}.retake-button{font-size:14px}.review-photo{padding:8px}}
@media print{#print-sheet img{max-width:none!important;max-height:none!important;flex-shrink:0}}
`);
let readme=fs.readFileSync(root+'README.md','utf8');
readme=readme.replace('Instructions dialog → choose 4 photos / 4 rows, 2 photos / 2 rows, or 6 photos / 3 rows → capture → edit → print or download.','Instructions dialog → choose reference Layout A–K (2 × 6, 4 × 6 or landscape 6 × 4 inches) → capture only the layout’s required photos → reorder or retake individually → edit → print or download.');
readme=readme.replace('four filters','six filters (Original, Vivid, Vintage with Grain, Cool, Yellow, B&W)');
readme+='\n## Reference-layout update\n\n`booth-core.js` defines exact card ratios, normalized photo slots, capture targets, immutable photo replacement/reordering, and pixel filters. A/B are 2×6 strips; C–E are portrait 4×6; F–K are landscape 6×4. Slot arrangements follow the supplied reference; margins are normalized for consistent output.\n\nManual mode takes one photo per click. Timer mode runs a 3, 5, or 7-second countdown for each unfilled slot and can be stopped without losing captured photos. A retake targets only its selected slot and retains the old photo until success. Both the session and editor support desktop drag, touch-handle drag, and accessible arrow-button reordering.\n\nExports are 600×1800, 1200×1800, or 1800×1200 pixels. The print image uses explicit inch dimensions; printer scaling and margins still depend on the browser/printer. Vintage grain is deterministic and rendered into both previews and exported images.\n';
fs.writeFileSync(root+'README.md',readme);
