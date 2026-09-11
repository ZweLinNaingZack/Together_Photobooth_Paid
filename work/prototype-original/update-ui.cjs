const fs = require('fs');
const root = 'outputs/together/';
let html = fs.readFileSync(root+'index.html','utf8');
html = html.replace('<a href="#booth" class="nav-cta">','<a href="#about" class="about-nav">About</a><a href="#booth" class="nav-cta">');
html = html.replace('<div class="hero-art" aria-label="Sample black and white and cherry red photo strips">','<div class="hero-art" role="button" tabindex="0" aria-pressed="false" aria-label="Separate the sample photo strips" aria-describedby="card-hint">');
html = html.replace('two webcams. one memory.</div></div>','two webcams. one memory.</div><span id="card-hint" class="card-hint">Hover or tap to give them a little space.</span></div>');
html = html.replace('      <footer>',`      <section class="faq" id="faq" aria-labelledby="faq-title">
        <div class="faq-intro"><div class="eyebrow">A FEW LITTLE ANSWERS</div><h2 id="faq-title">Wondering<br><em>about something?</em></h2><p>Before you step into the booth.</p></div>
        <div class="faq-list">
          <details><summary>How does Together work?<span aria-hidden="true">+</span></summary><div class="faq-answer"><p>The idea is simple: open a booth, send your person a link, and take photos together from two webcams. Then choose your filters, personalize the strip, and save it. Right now, you can try the design with sample photos; live cameras and shared rooms are coming next.</p></div></details>
          <details><summary>Are my photos and data safe?<span aria-hidden="true">+</span></summary><div class="faq-answer"><p>This preview does not access your camera or upload your photos. Your caption and edits stay in this browser tab, and the sample strip is created on your device when you download it. Refreshing clears your edits. The site host and font provider may receive normal web-request information. We’ll explain live-session privacy before that feature launches.</p></div></details>
          <details><summary>Do I need to sign up or pay?<span aria-hidden="true">+</span></summary><div class="faq-answer"><p>No account or payment is required to try this preview or download a sample strip. Together is a student portfolio project, with a free, no-signup photobooth as the goal.</p></div></details>
          <details><summary>Can I use it on my phone?<span aria-hidden="true">+</span></summary><div class="faq-answer"><p>Yes, this preview adapts to phones, tablets, and desktops. Tap the photo strips to separate them, and tap again to bring them back. Live camera support on mobile will be tested when the camera feature is added.</p></div></details>
          <details><summary>Can I save or print my photocard?<span aria-hidden="true">+</span></summary><div class="faq-answer"><p>Yes. Choose PNG or JPG in the booth, then save your sample strip. You can keep the file, share it yourself, or print it. The current download uses sample portraits; your own photos will be available once live capture is ready.</p></div></details>
        </div>
      </section>
      <footer>`);
html = html.replace('    <section id="booth"',`    <section id="about" class="about-page" hidden aria-labelledby="about-title">
      <a class="back-link" href="#">← Back home</a>
      <div class="about-intro"><div class="eyebrow">A SMALL IDEA, FOR THE PEOPLE YOU MISS</div><h1 id="about-title">Miles apart.<br><em>Still together.</em></h1><p>For the dates that happen through a screen.<br>The best friends in different time zones.<br>The people you wish were a little closer.</p></div>
      <div class="about-story"><span class="about-mark" aria-hidden="true">✳</span><div><h2>A photobooth without<br><em>the same postcode.</em></h2><p>Some of the nicest memories are the unplanned ones: a silly face, a laugh you couldn’t hold in, one more photo before you go. Distance shouldn’t mean missing out on those little rituals.</p><p>Together is an online photobooth being built for couples and friends who can’t step into a booth side by side. The plan is to bring two webcams into one shared moment, then turn that moment into a photocard you can make your own.</p></div></div>
      <div class="about-notes"><article><span class="step-number">01</span><h3>Made for your people.</h3><p>A shared link, a little time together, and room to be yourselves. No profiles to build or feeds to scroll.</p></article><article><span class="step-number">02</span><h3>A keepsake that feels like you.</h3><p>Pick a mood, choose a frame color, and add a few words. A small souvenir of being together.</p></article><article><span class="step-number">03</span><h3>Built with a little curiosity.</h3><p>This is a student portfolio project, created while learning computer science and software engineering with AI assistance.</p></article></div>
      <div class="about-preview"><div><div class="eyebrow">WHERE WE ARE TODAY</div><h2>A little work <em>in progress.</em></h2><p>You can explore the booth with sample photos, try filters and frames, and download a sample strip. Real webcam sessions and invitation links are the next chapter.</p></div><a class="primary" href="#booth">Take the photos now <span aria-hidden="true">↗</span></a></div>
    </section>
    <section id="booth"`);
fs.writeFileSync(root+'index.html',html);
let js=fs.readFileSync(root+'app.js','utf8');
const start=js.indexOf('function route()');
const end=js.indexOf("document.querySelectorAll('[data-filter]')",start);
js=js.slice(0,start)+`const about=document.querySelector('#about');
function route(){
  const isBooth=location.hash==='#booth',isAbout=location.hash==='#about';
  home.hidden=isBooth||isAbout;booth.hidden=!isBooth;about.hidden=!isAbout;
  document.querySelector('.home-nav').hidden=isBooth;
  document.querySelector('.nav-cta').hidden=isBooth;
  document.querySelector('.about-nav').setAttribute('aria-current',isAbout?'page':'false');
  document.title=isBooth?'Your booth — Together':isAbout?'About — Together':'Together — A little closer.';
  if(isBooth||isAbout||!location.hash)window.scrollTo(0,0);
  else requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView());
  if(!isBooth&&busy){clearTimeout(countdownTimer);finishCountdown(false)}
}
window.addEventListener('hashchange',route);route();
const heroArt=document.querySelector('.hero-art');
function spreadCards(spread){heroArt.classList.toggle('cards-apart',spread);heroArt.setAttribute('aria-pressed',String(spread));heroArt.setAttribute('aria-label',spread?'Bring the sample photo strips together':'Separate the sample photo strips')}
heroArt.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')spreadCards(true)});
heroArt.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')spreadCards(false)});
heroArt.addEventListener('click',e=>{if(e.pointerType!=='mouse')spreadCards(!heroArt.classList.contains('cards-apart'))});
heroArt.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();spreadCards(!heroArt.classList.contains('cards-apart'))}if(e.key==='Escape')spreadCards(false)});
heroArt.addEventListener('blur',()=>spreadCards(false));
document.addEventListener('pointerdown',e=>{if(!heroArt.contains(e.target))spreadCards(false)});
`+js.slice(end);
fs.writeFileSync(root+'app.js',js);
fs.appendFileSync(root+'style.css',`
/* Translate the cards independently of their existing tilt and entrance animation. */
.hero-art{cursor:pointer;border-radius:14px;--card-space:26px}
.hero-art:focus-visible{outline:2px dashed var(--red);outline-offset:8px}
.hero-art .strip{transition:translate .65s cubic-bezier(.22,1,.36,1),box-shadow .65s;translate:0 0}
.hero-art.cards-apart .strip-back{translate:calc(-1 * var(--card-space)) -10px;box-shadow:0 22px 34px #25282324}
.hero-art.cards-apart .strip-front{translate:var(--card-space) 10px;box-shadow:0 22px 34px #25282324}
.card-hint{position:absolute;left:25px;bottom:-45px;font-size:12px;color:var(--muted);cursor:inherit}
.about-nav[aria-current="page"]{color:var(--red);text-decoration:underline;text-underline-offset:6px}
.faq{max-width:1440px;margin:auto;padding:95px 8%;display:grid;grid-template-columns:1fr 1.3fr;gap:70px}
.faq h2{margin:20px 0}.faq-intro>p{color:var(--muted);line-height:1.7}
.faq-list details{border-bottom:1px solid var(--line)}.faq-list details:first-child{border-top:1px solid var(--line)}
.faq-list summary{list-style:none;cursor:pointer;padding:24px 0;display:flex;align-items:center;justify-content:space-between;gap:22px;font-size:17px;font-weight:500;line-height:1.5}
.faq-list summary::-webkit-details-marker{display:none}.faq-list summary:hover{color:var(--red)}
.faq-list summary:focus-visible{outline:2px solid var(--red);outline-offset:5px}
.faq-list summary span{font-size:27px;font-weight:400;color:var(--red);transition:transform .25s;flex-shrink:0}
.faq-list details[open] summary span{transform:rotate(45deg)}
.faq-answer{padding:0 32px 24px 0;color:var(--muted);font-size:16px;line-height:1.8}
.faq-list details[open] .faq-answer{animation:rise .3s ease both}
.about-page{max-width:1440px;margin:auto;padding:40px 8% 85px}
.about-intro{text-align:center;padding:55px 0 65px}.about-intro .eyebrow{justify-content:center}
.about-intro h1{font-size:clamp(72px,8vw,110px);margin:25px 0 30px}
.about-intro>p{font-size:18px;line-height:1.85;color:var(--muted)}
.about-story{border-top:1px solid var(--line);padding:60px 0;display:grid;grid-template-columns:1fr 2fr;gap:50px}
.about-mark{font-size:160px;color:var(--red);align-self:center;justify-self:center}
.about-story h2{margin-bottom:25px}.about-story p{max-width:670px;line-height:1.85;color:var(--muted);margin-top:18px}
.about-notes{display:grid;grid-template-columns:repeat(3,1fr);gap:36px;padding:40px 0 65px;border-top:1px solid var(--line)}
.about-notes h3{margin-top:18px}.about-notes p{line-height:1.8;color:var(--muted)}
.about-preview{background:#e9ecdf;border:1px solid #d9decb;border-radius:8px;padding:38px;display:flex;align-items:center;gap:45px}
.about-preview h2{font-size:44px;margin:17px 0}.about-preview p{line-height:1.8;color:var(--muted);max-width:630px}.about-preview .primary{flex-shrink:0}
@media(max-width:1100px){.hero-art{--card-space:18px}.faq{gap:35px;padding:75px 6%}.about-preview{flex-direction:column;align-items:flex-start}}
@media(max-width:800px){.hero-art{--card-space:20px}.card-hint{bottom:-38px}.faq{grid-template-columns:1fr;gap:28px;padding:65px 7%}.faq h2{font-size:53px}.about-page{padding:28px 7% 60px}.about-story{grid-template-columns:1fr;gap:15px;padding:35px 0}.about-mark{font-size:70px;justify-self:start}.about-story h2{font-size:48px}.about-notes{grid-template-columns:1fr;gap:30px}.about-preview{padding:25px}.about-intro{padding:45px 0}.about-intro>p{font-size:16px}.header nav{gap:17px}}
@media(max-width:420px){.hero-art{--card-space:16px}.card-hint{left:55px}.faq-list summary{font-size:16px}.faq h2{font-size:48px}.about-intro h1{font-size:70px}.about-intro .eyebrow{font-size:10px;line-height:1.7}.about-story h2{font-size:43px}.header nav{gap:13px}.header .nav-cta{padding:10px 13px}.nav-cta span{margin-left:8px}}
`);
