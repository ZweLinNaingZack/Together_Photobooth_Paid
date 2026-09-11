const home=document.querySelector('#home');
const booth=document.querySelector('#booth');
document.querySelectorAll('[data-pairs]').forEach(container=>{for(let i=0;i<Number(container.dataset.pairs);i++){const pair=document.createElement('div');pair.className='photo-pair';['woman','man'].forEach(person=>{const img=document.createElement('img');img.src=`public/${person}.jpg`;img.alt='';img.loading='eager';pair.append(img)});container.append(pair)}});
const about=document.querySelector('#about');
function route(){
  const isBooth=location.hash==='#booth',isAbout=location.hash==='#about';
  home.hidden=isBooth||isAbout;booth.hidden=!isBooth;about.hidden=!isAbout;
  document.querySelector('.home-nav').hidden=isBooth;
  document.querySelector('.nav-cta').hidden=isBooth;
  document.querySelector('.about-nav').setAttribute('aria-current',isAbout?'page':'false');
  document.title=isBooth?'Your booth — Together':isAbout?'About — Together':'Together — A little closer.';
  if(isBooth||isAbout||!location.hash)window.scrollTo(0,0);
  else requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView());
  window.dispatchEvent(new CustomEvent('booth-route',{detail:{active:isBooth}}));
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
