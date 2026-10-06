import {useEffect,useRef,useState} from 'react';
import type {CardState} from './types';
import {PhotoPan} from './PhotoPan';
export function ExpandedPhotoEditor({open,onClose,preview,card,onChange}:{open:boolean;onClose:()=>void;preview:string;card:CardState;onChange:(patch:Partial<CardState>)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [zoom,setZoom]=useState(1);
 useEffect(()=>{if(open){dialog.current?.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{dialog.current?.close();document.body.style.overflow=overflow;};}},[open]);
 return <dialog ref={dialog} className="expanded-photo-editor" aria-labelledby="position-editor-title" onCancel={e=>{e.preventDefault();onClose();}}>
  <header><div><h2 id="position-editor-title">Position your photos</h2><p>Drag each photo to fit. Changes are saved as you move.</p></div><button className="primary" autoFocus onClick={onClose}>Done positioning</button></header>
  <div className="expanded-photo-scroll"><div className="pan-surface" style={{height:`${72*zoom}dvh`,width:`${100*zoom}%`}}><img src={preview} alt="Expanded photocard for positioning" draggable={false}/><PhotoPan card={card} onChange={onChange}/></div></div>
  <footer><label>Zoom <input type="range" min="1" max="2.5" step=".25" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label><button className="outline-button" onClick={()=>onChange({offsets:card.shots.map(()=>({x:.5,y:.5}))})}>Center all photos</button><p>Drag inside photos; scroll around the enlarged card. Arrow keys also move a focused photo.</p></footer>
 </dialog>;
}
