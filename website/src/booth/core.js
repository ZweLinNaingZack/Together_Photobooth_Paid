/* One layout definition drives selection, capture limits, preview and export. */

  /** @param {number} x @param {number} y @param {number} w @param {number} h */
  const rect=(x,y,w,h)=>({x,y,w,h});
  /** @param {string} id @param {number} width @param {number} height @param {ReturnType<typeof rect>[]} slots @param {string} label @param {ReturnType<typeof rect>} caption */
  function layout(id,width,height,slots,label,caption){return {id,name:`Layout ${id}`,width,height,slots,count:slots.length,label,caption,note:`${width===600?'2 × 6':width===1200?'4 × 6':'6 × 4'} in · ${slots.length} photo${slots.length===1?'':'s'}`}}
  const layouts={
    A:layout('A',600,1800,[rect(.04,.02,.92,.22),rect(.04,.25,.92,.22),rect(.04,.48,.92,.22)],'Three little moments',rect(.06,.73,.88,.24)),
    B:layout('B',600,1800,[rect(.04,.02,.92,.215),rect(.04,.245,.92,.215),rect(.04,.47,.92,.215),rect(.04,.695,.92,.215)],'The classic four',rect(.06,.925,.88,.06)),
    C:layout('C',1200,1800,[rect(.035,.025,.46,.405),rect(.505,.025,.46,.405),rect(.035,.44,.46,.405),rect(.505,.44,.46,.405)],'Four in a frame',rect(.04,.865,.92,.115)),
    D:layout('D',1200,1800,[rect(.035,.025,.93,.80)],'One big moment',rect(.05,.85,.90,.13)),
    E:layout('E',1200,1800,[rect(.035,.025,.93,.395),rect(.035,.43,.93,.395)],'Two, side by side in time',rect(.05,.85,.90,.13)),
    F:layout('F',1800,1200,[rect(.025,.035,.95,.78)],'The wide one',rect(.04,.84,.92,.13)),
    G:layout('G',1800,1200,[rect(.025,.18,.47,.46),rect(.505,.18,.47,.46)],'A pair of moments',rect(.05,.70,.9,.25)),
    H:layout('H',1800,1200,[rect(.025,.035,.47,.53),rect(.025,.58,.31,.385),rect(.345,.58,.31,.385),rect(.665,.58,.31,.385)],'One above, three below',rect(.53,.07,.42,.45)),
    I:layout('I',1800,1200,[rect(.025,.035,.47,.455),rect(.025,.505,.47,.46),rect(.505,.505,.47,.46)],'The little L',rect(.54,.07,.40,.38)),
    J:layout('J',1800,1200,[rect(.025,.035,.47,.455),rect(.505,.035,.47,.455),rect(.025,.505,.47,.46)],'Three, with a little space',rect(.54,.55,.40,.36)),
    K:layout('K',1800,1200,[rect(.025,.035,.47,.455),rect(.025,.505,.47,.46)],'Two with room for words',rect(.54,.13,.40,.72))
  };
  const filters={original:'Original',vivid:'Vivid',vintage:'Vintage with Grain',cool:'Cool',yellow:'Yellow',bw:'B&W',sepia:'Sepia',noir:'Noir',glow:'Soft Glow',pink:'Dreamy Pink',fade:'Film Fade',flashpop:'Flash Pop'};
  function move(shots,from,to){const result=[...shots];if(from<0||to<0||from>=result.length||to>=result.length)return result;result.splice(to,0,result.splice(from,1)[0]);return result}
  function captureTargets(shots,count,retake=null,manual=false){if(retake!==null)return retake>=0&&retake<count?[retake]:[];const missing=Array.from({length:count},(_,i)=>i).filter(i=>!shots[i]);return manual?missing.slice(0,1):missing}
  function replaceShot(shots,index,shot){const next=[...shots];next[index]=shot;return next}
  function filterPixels(data,filter,seed=7){if(filter==='original')return data;let random=seed>>>0;for(let i=0;i<data.length;i+=4){let r=data[i],g=data[i+1],b=data[i+2],l=.299*r+.587*g+.114*b;
      if(filter==='bw')r=g=b=l;
      if(filter==='vivid'){r=(l+(r-l)*1.32-128)*1.1+128;g=(l+(g-l)*1.32-128)*1.1+128;b=(l+(b-l)*1.32-128)*1.1+128}
      if(filter==='cool'){r=r*.93;g=g*1.015;b=b*1.10+6}
      if(filter==='yellow'){r=r*1.06+5;g=g*1.04+4;b=b*.87}
      if(filter==='vintage'){random=(Math.imul(1664525,random)+1013904223)>>>0;const grain=(random/4294967296-.5)*25;r=(l+(r-l)*.65)*.95+17+grain;g=(l+(g-l)*.65)*.91+13+grain;b=(l+(b-l)*.65)*.80+12+grain}
      if(filter==='sepia'){r=l*1.17+18;g=l*.98+8;b=l*.72}
      if(filter==='noir'){l=(l-128)*1.52+128;r=g=b=l}
      if(filter==='glow'){r=(r-128)*.82+145;g=(g-128)*.82+145;b=(b-128)*.82+145}
      if(filter==='pink'){r=(r-128)*.88+145;g=(g-128)*.83+133;b=(b-128)*.86+146}
      if(filter==='fade'){r=(r-128)*.72+142;g=(g-128)*.72+140;b=(b-128)*.70+132}
      if(filter==='flashpop'){r=(r-128)*1.18+140;g=(g-128)*1.13+138;b=(b-128)*1.15+148}
      data[i]=Math.min(255,Math.max(0,r));data[i+1]=Math.min(255,Math.max(0,g));data[i+2]=Math.min(255,Math.max(0,b));
    }return data}
export {layouts,filters,move,captureTargets,replaceShot,filterPixels};
