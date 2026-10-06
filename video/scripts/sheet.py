import sys,glob
from PIL import Image
pat,out,cols=sys.argv[1],sys.argv[2],int(sys.argv[3])
fs=sorted(glob.glob(pat),key=lambda f:float(f.rsplit('-',1)[-1][:-4]))
ims=[Image.open(f) for f in fs]
tw=1280//cols; th=int(ims[0].height*tw/ims[0].width)
ims=[i.resize((tw,th)) for i in ims]
rows=(len(ims)+cols-1)//cols
W=Image.new('RGB',(tw*cols,th*rows),'white')
for i,im in enumerate(ims): W.paste(im,((i%cols)*tw,(i//cols)*th))
W.save(out)
