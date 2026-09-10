from PIL import Image
import numpy as np
from pathlib import Path
import json
out={}
def runs(values):
 padded=np.r_[False,values,False].astype(int); starts=np.where(np.diff(padded)==1)[0]; ends=np.where(np.diff(padded)==-1)[0]
 return list(zip(starts,ends))
for p in Path('sample-photocard-desgin-all').glob('*.png'):
 im=Image.open(p).convert('RGB'); a=np.array(im).astype(int)
 mask=(a[:,:,2]>a[:,:,0]+8)&(a[:,:,1]>a[:,:,0]+3)&(a[:,:,0]>120)
 boxes=[]
 for y0,y1 in runs(mask.sum(axis=1)>30):
  for x0,x1 in runs(mask[y0:y1].sum(axis=0)>30):
   if (y1-y0)*(x1-x0)>20000: boxes.append(tuple(map(int,(x0,y0,x1,y1))))
 out[p.stem[-1]]={'size':im.size,'boxes':boxes}
print(json.dumps(out))
Path('work/design-geometry.json').write_text(json.dumps(out))
