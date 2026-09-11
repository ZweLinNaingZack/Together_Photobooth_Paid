const fs=require('fs');const root='outputs/together/';
let html=fs.readFileSync(root+'index.html','utf8');
const start=html.indexOf('    <section id="booth"');
html=html.slice(0,start)+`    <section id="booth" class="booth flow-booth" hidden aria-label="Photobooth">
      <div class="flow-top"><a href="#" class="back-link">← Leave the booth</a><button class="text-button" id="show-instructions">How it works</button></div>
      <ol class="flow-steps" aria-label="Your photobooth progress"><li data-step="layout">01 <span>Your layout</span></li><li data-step="session">02 <span>Your moment</span></li><li data-step="edit">03 <span>Your keepsake</span></li></ol>
      <div id="flow-screen"></div>
    </section>
    <dialog id="instructions" aria-labelledby="instructions-title"><button class="dialog-close" aria-label="Close instructions">×</button><div class="eyebrow">A LITTLE HELLO BEFORE WE BEGIN</div><h2 id="instructions-title">Make yourself<br><em>right at home.</em></h2><p class="intro-copy">A few little steps. A memory to keep.</p><ol class="instruction-list"><li><span>01</span><div><strong>Pick your photocard.</strong><p>Choose two, four, or six photos. We’ll make room for every moment.</p></div></li><li><span>02</span><div><strong>Get in frame.</strong><p>Use your camera for a solo session, or try sample photos. There’s a three-second countdown before each shot.</p></div></li><li><span>03</span><div><strong>Make it yours.</strong><p>After the session, choose a frame, color, and filter. Then download or print your card.</p></div></li></ol><p class="dialog-note">Shared sessions with a friend are coming next. Camera access is optional and only starts when you turn it on.</p><button class="primary" id="instructions-continue">Let’s begin <span aria-hidden="true">↗</span></button></dialog>
    <div id="print-sheet" aria-hidden="true"></div>
  </main>
</body></html>`;
html=html.replace('<script src="app.js" defer></script>','<script src="app.js" defer></script><script src="booth-flow.js" defer></script>');
html=html.replace('This preview does not access your camera or upload your photos. Your caption and edits stay in this browser tab, and the sample strip is created on your device when you download it.', 'Camera access only starts when you choose “Turn camera on.” Photos, captions, and edits stay in this browser tab; this app does not upload them. Your photocard is created on your device when you download or print it.');
html=html.replace('Right now, you can try the design with sample photos; live cameras and shared rooms are coming next.', 'Right now, you can take solo camera photos or try sample photos. Shared rooms with a friend are coming next.');
html=html.replace('Live camera support on mobile will be tested when the camera feature is added.', 'Camera access depends on your browser and permission settings. You can also use sample photos to try the flow.');
html=html.replace('The current download uses sample portraits; your own photos will be available once live capture is ready.', 'Your download includes the photos from your session, in the layout and style you chose.');
html=html.replace('Real webcam sessions and invitation links are the next chapter.', 'Solo webcam capture is available; shared sessions and invitation links are the next chapter.');
fs.writeFileSync(root+'index.html',html);
let js=fs.readFileSync(root+'app.js','utf8');
js=js.slice(0,js.indexOf("document.querySelectorAll('[data-filter]')"));
js=js.replace(/const filters=.*\r?\nconst colors=.*\r?\nlet activeFilter=.*\r?\n/,'');
js=js.replace('if(!isBooth&&busy){clearTimeout(countdownTimer);finishCountdown(false)}',"window.dispatchEvent(new CustomEvent('booth-route',{detail:{active:isBooth}}));");
fs.writeFileSync(root+'app.js',js);
let build=fs.readFileSync(root+'build.mjs','utf8').replace("'style.css','app.js'","'style.css','app.js','booth-flow.js'");fs.writeFileSync(root+'build.mjs',build);
