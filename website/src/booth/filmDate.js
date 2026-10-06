export function localDate(date=new Date()){
 return `${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')}.${date.getFullYear()}`;
}
export function filmDateRegion(key){
 if(key==='film-negative')return {x:550,y:1435,w:170,h:50,size:29};
 if(key==='sasha-film-b')return {x:326,y:1631,w:212,h:62,size:34};
 if(['sasha-film-c','sasha-film-d','sasha-film-e'].includes(key))return {x:750,y:1631,w:228,h:62,size:36};
 if(['sasha-film-g','sasha-film-k'].includes(key))return {x:1160,y:1094,w:272,h:70,size:42};
 return null;
}
export function drawFilmDate(ctx,design,key,scale,date=localDate()){
 const r=filmDateRegion(key);if(!r)return;
 ctx.save();ctx.translate(-design.crop[0]*scale,-design.crop[1]*scale);ctx.scale(scale,scale);
 ctx.fillStyle='#000';ctx.fillRect(r.x,r.y,r.w,r.h);
 ctx.fillStyle='#fff';ctx.font=`${r.size}px Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillText(date,r.x+r.w/2,r.y+r.h/2,r.w-8);ctx.restore();
}
