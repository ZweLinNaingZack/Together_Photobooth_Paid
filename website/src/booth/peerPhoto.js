// Check encoded JPEG structure before handing peer data to a browser decoder.
// Camera originals are <=1920px; these bounds also allow shared composites.
const prefix='data:image/jpeg;base64,';
const invalid=()=>new Error('The shared photo is invalid or too large. Please retake it.');
export function jpegDimensions(photo){
 if(typeof photo!=='string'||!photo.startsWith(prefix)||photo.length>6000000)throw invalid();
 const encoded=photo.slice(prefix.length);
 if(!encoded||encoded.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw invalid();
 let bytes;try{bytes=atob(encoded);}catch{throw invalid();}
 const byte=i=>bytes.charCodeAt(i),word=i=>byte(i)*256+byte(i+1);
 if(word(0)!==0xffd8)throw invalid();
 let at=2,dimensions=null,scan=false;
 while(at<bytes.length){
  if(scan){at=bytes.indexOf('\xff',at);if(at<0)throw invalid();}
  if(byte(at++)!==255)throw invalid();
  while(byte(at)===255)at++;
  const marker=byte(at++);
  if(scan&&(marker===0||marker>=0xd0&&marker<=0xd7))continue;
  if(marker===0xd9){if(!dimensions||!scan||at!==bytes.length)throw invalid();return dimensions;}
  if(marker===0xd8||marker===0xdc||marker===0||marker===1||marker>=0xd0&&marker<=0xd7)throw invalid();
  if(at+2>bytes.length)throw invalid();
  const length=word(at);if(length<2||at+length>bytes.length)throw invalid();
  if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker)){
   if(dimensions||![0xc0,0xc1,0xc2].includes(marker)||length<8||byte(at+2)!==8)throw invalid();
   const height=word(at+3),width=word(at+5),components=byte(at+7);
   if(![1,3].includes(components)||length!==8+3*components||!width||!height||width>8192||height>8192||width*height>16000000||Math.max(width/height,height/width)>16)throw invalid();
   dimensions={width,height};
  }
  if(marker===0xda){if(!dimensions)throw invalid();scan=true;}
  at+=length;
 }
 throw invalid();
}

export function validatePeerPhotos(event){
 if(!['capture-original','shot','photos'].includes(event.type))return;
 const photos=event.type==='capture-original'?[event.photo]:event.type==='shot'?[event.shot]:event.shots;
 if(!Array.isArray(photos)||photos.length>16)throw invalid();
 let pixels=0;
 for(const photo of photos){
  if(photo===''&&event.type==='photos')continue;
  const {width,height}=jpegDimensions(photo);pixels+=width*height;
  if(pixels>64000000)throw invalid();
 }
}
