import {useEffect,useRef,useState} from 'react';
import type {CardState} from './types';
import {PhotoPan} from './PhotoPan';
import { useT } from '../i18n';
export function ExpandedPhotoEditor({open,onClose,preview,card,onChange}:{open:boolean;onClose:()=>void;preview:string;card:CardState;onChange:(patch:Partial<CardState>)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [zoom,setZoom]=useState(1);
 const t=useT();
 useEffect(()=>{if(open){dialog.current?.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{dialog.current?.close();document.body.style.overflow=overflow;};}},[open]);
 return <dialog ref={dialog} className="expanded-photo-editor" aria-labelledby="position-editor-title" onCancel={e=>{e.preventDefault();onClose();}}>
  <header><div><h2 id="position-editor-title">{t('position.title')}</h2><p>{t('position.text')}</p></div><button className="primary" autoFocus onClick={onClose}>{t('position.done')}</button></header>
  <div className="expanded-photo-scroll"><div className="pan-surface" style={{height:`${72*zoom}dvh`,width:`${100*zoom}%`}}><img src={preview} alt={t('position.alt')} draggable={false}/><PhotoPan card={card} onChange={onChange}/></div></div>
  <footer><label>{t('position.zoom')} <input type="range" min="1" max="2.5" step=".25" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label><button className="outline-button" onClick={()=>onChange({offsets:card.shots.map(()=>({x:.5,y:.5}))})}>{t('position.center')}</button><p>{t('position.help')}</p></footer>
 </dialog>;
}
