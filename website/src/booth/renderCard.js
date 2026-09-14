import { layouts,filterPixels } from './core.js';
import { cardDesigns,colors } from './designs.ts';
  const loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src});
  function cover(ctx,img,x,y,w,h){const iw=img.videoWidth||img.naturalWidth,ih=img.videoHeight||img.naturalHeight;const scale=Math.max(w/iw,h/ih);ctx.drawImage(img,(iw-w/scale)/2,(ih-h/scale)/2,w/scale,h/scale,x,y,w,h)}
  async function renderDesignedCard(state){
    const snapshot={...state,shots:[...state.shots]},d=cardDesigns[snapshot.template];if(!d || (d.layout||'A')!==snapshot.layout || snapshot.shots.length!==d.slots.length)throw Error('Choose the matching layout and fill every photo slot');
    const [art,...images]=await Promise.all([loadImage(d.src),...snapshot.shots.map(shot => shot ? loadImage(shot) : snapshot.preview ? Promise.resolve(null) : Promise.reject(Error("Missing photo")))]);
    const [cx,cy,cw,ch]=d.crop,scale=600/cw,ox=0,oy=0;
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=Math.round(ch*scale);const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(art,cx,cy,cw,ch,0,0,canvas.width,canvas.height);
    images.forEach((img,i)=>{if(!img)return;const r=d.slots[i],w=Math.round(r.w*scale),h=Math.round(r.h*scale),photo=document.createElement('canvas');photo.width=w;photo.height=h;const pc=photo.getContext('2d',{willReadFrequently:true});cover(pc,img,0,0,w,h);
      if(snapshot.filter!=='original'){const pixels=pc.getImageData(0,0,w,h);filterPixels(pixels.data,snapshot.filter,17+i);pc.putImageData(pixels,0,0)}
      if(d.mask==='cream'){const mask=document.createElement('canvas');mask.width=w;mask.height=h;const mc=mask.getContext('2d',{willReadFrequently:true});mc.drawImage(art,r.x,r.y,r.w,r.h,0,0,w,h);const mp=mc.getImageData(0,0,w,h);for(let p=0;p<mp.data.length;p+=4)mp.data[p+3]=(mp.data[p]>215&&mp.data[p+1]>205&&mp.data[p+2]>175)?255:0;mc.putImageData(mp,0,0);pc.globalCompositeOperation='destination-in';pc.drawImage(mask,0,0)}
      const x=ox+(r.x-cx)*scale,y=oy+(r.y-cy)*scale;ctx.save();if(r.rotation){const [angle,rx,ry]=r.rotation;const tx=(rx-cx)*scale,ty=(ry-cy)*scale;ctx.translate(tx,ty);ctx.rotate(angle*Math.PI/180);ctx.translate(-tx,-ty)}ctx.beginPath();if(r.poly){r.poly.forEach(([px,py],n)=>{const dx=ox+(px-cx)*scale,dy=oy+(py-cy)*scale;n?ctx.lineTo(dx,dy):ctx.moveTo(dx,dy)});ctx.closePath()}else ctx.roundRect(x,y,w,h,(r.r||0)*scale);ctx.clip();ctx.drawImage(photo,x,y,w,h);ctx.restore();
    });return canvas;
  }
  async function renderCard(state){if(state.template)return renderDesignedCard(state);const snapshot={...state,shots:[...state.shots]},l=layouts[snapshot.layout],canvas=document.createElement('canvas');canvas.width=l.width;canvas.height=l.height;const ctx=canvas.getContext('2d'),[bg,fg]=colors[snapshot.color];const images=await Promise.all(snapshot.shots.map(loadImage));await document.fonts.ready;ctx.fillStyle=bg;ctx.fillRect(0,0,l.width,l.height);
    images.forEach((img,i)=>{const r=l.slots[i],x=Math.round(r.x*l.width),y=Math.round(r.y*l.height),w=Math.round(r.w*l.width),h=Math.round(r.h*l.height);const photo=document.createElement('canvas');photo.width=w;photo.height=h;const pc=photo.getContext('2d',{willReadFrequently:true});cover(pc,img,0,0,w,h);if(snapshot.filter!=='original'){const pixels=pc.getImageData(0,0,w,h);filterPixels(pixels.data,snapshot.filter,17+i);pc.putImageData(pixels,0,0)}ctx.drawImage(photo,x,y);if(snapshot.design==='outline'){ctx.strokeStyle=fg;ctx.lineWidth=2;ctx.strokeRect(x+5,y+5,w-10,h-10)}});
    const a=l.caption,cx=(a.x+a.w/2)*l.width,cy=(a.y+a.h/2)*l.height,available=a.w*l.width-18;ctx.fillStyle=fg;ctx.textAlign='center';let size=Math.min(66,a.h*l.height*.33);ctx.font=`italic ${size}px "DM Sans", sans-serif`;while(ctx.measureText(snapshot.caption).width>available&&size>12){ctx.font=`italic ${--size}px "DM Sans", sans-serif`}ctx.fillText(snapshot.caption,cx,cy+size*.12);if(a.h*l.height>130){ctx.font=`500 ${Math.min(20,a.w*l.width/23)}px "DM Sans", sans-serif`;ctx.fillText('T O G E T H E R',cx,cy+size*.9+16)}if(snapshot.design==='hearts'){ctx.font=`${Math.min(30,a.h*l.height*.18)}px "DM Sans", sans-serif`;ctx.fillText('♡',cx,cy-size*.7)}return canvas;
  }

export {renderCard,loadImage,cover};
