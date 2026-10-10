import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { CardState } from './types';
import { cardDesigns } from './designs';
import type { CardDesign } from './designs';
import { layouts } from './core';
import { panOffset, clampOffset } from './photoPosition.js';
import { useT } from '../i18n';

export function PhotoPan({card,onChange}:{card:CardState;onChange:(patch:Partial<CardState>)=>void}) {
  const [sizes,setSizes]=useState<{w:number;h:number}[]>([]);
  const t=useT();
  const drag=useRef<{id:number;index:number;x:number;y:number;offset:{x:number;y:number};matrix:DOMMatrix}|null>(null);
  const design=card.template ? cardDesigns[card.template] : null, layout=layouts[card.layout];
  const [cx,cy,w,h]=design?.crop || [0,0,layout.width,layout.height];
  const slots: CardDesign['slots']=design?.slots || layout.slots.map(r=>({x:r.x*w,y:r.y*h,w:r.w*w,h:r.h*h,r:0}));
  useEffect(()=>{let cancelled=false;setSizes([]);drag.current=null;Promise.all(card.shots.map(src=>new Promise<{w:number;h:number}>(resolve=>{const img=new Image();img.onload=()=>resolve({w:img.naturalWidth,h:img.naturalHeight});img.onerror=()=>resolve({w:0,h:0});img.src=src;}))).then(result=>{if(!cancelled)setSizes(result);});return()=>{cancelled=true;};},[card.shots]);
  useEffect(()=>{drag.current=null;},[card.template]);
  function update(index:number,offset:{x:number;y:number}) {const offsets=card.shots.map((_,i)=>card.offsets?.[i]||{x:.5,y:.5});offsets[index]=offset;onChange({offsets});}
  function start(e:PointerEvent<SVGPathElement>,index:number){
    if(e.button!==0 || !sizes[index]?.w)return;
    const matrix=e.currentTarget.getScreenCTM()?.inverse();if(!matrix)return;
    e.preventDefault();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix);
    drag.current={id:e.pointerId,index,x:p.x,y:p.y,matrix,offset:card.offsets?.[index]||{x:.5,y:.5}};
  }
  function move(e:PointerEvent<SVGPathElement>){const d=drag.current;if(!d||d.id!==e.pointerId)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(d.matrix),s=slots[d.index],size=sizes[d.index];update(d.index,panOffset(d.offset,p.x-d.x,p.y-d.y,size.w,size.h,s.w,s.h));}
  return <svg className="photo-pan" viewBox={`${cx} ${cy} ${w} ${h}`} aria-label={t('pan.label')} preserveAspectRatio="xMidYMid meet">
    {slots.map((slot,i)=>{
      const path=slot.poly ? `M${slot.poly.map(p=>p.join(' ')).join(' L')}Z` : `M${slot.x} ${slot.y}h${slot.w}v${slot.h}h${-slot.w}Z`;
      return <path key={i} d={path} transform={slot.rotation ? `rotate(${slot.rotation.join(' ')})` : undefined} tabIndex={0} role="button" aria-label={t('pan.photo', { n: i + 1 })}
        onPointerDown={e=>start(e,i)} onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
        onKeyDown={e=>{
          const offset=card.offsets?.[i]||{x:.5,y:.5};
          if(e.key==='Home'){e.preventDefault();update(i,{x:.5,y:.5});}
          else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
            e.preventDefault();update(i,{x:clampOffset(offset.x+(e.key==='ArrowLeft' ? .05 : e.key==='ArrowRight' ? -.05 : 0)),y:clampOffset(offset.y+(e.key==='ArrowUp' ? .05 : e.key==='ArrowDown' ? -.05 : 0))});
          }
        }} />;
    })}
  </svg>;
}
