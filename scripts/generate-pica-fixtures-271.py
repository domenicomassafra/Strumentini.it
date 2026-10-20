from PIL import Image,ImageDraw
import random
random.seed(271)
w,h=1200,800
im=Image.new('RGB',(w,h))
p=im.load()
for y in range(h):
 for x in range(w):
  v=((x*17+y*31) % 256) if ((x//19+y//17)%2) else ((x*13-y*11) % 256)
  p[x,y]=(v,(x*7+y*3)%256,(x//11*31+y//13*29)%256)
d=ImageDraw.Draw(im)
for i in range(50):
 x=random.randrange(w);y=random.randrange(h);d.line((x,y,min(w,x+random.randrange(20,150)),min(h,y+random.randrange(20,150))),fill=(255,255,0),width=2)
im.save('.scratch/pica-271-input.png')
im.resize((300,200),Image.Resampling.LANCZOS).save('.scratch/pica-271-oracle.png')


orientation=Image.new("RGB",(120,80))
draw=ImageDraw.Draw(orientation)
draw.rectangle((0,0,59,79),fill=(250,20,20))
draw.rectangle((60,0,119,79),fill=(20,20,250))
exif=Image.Exif()
exif[274]=6
orientation.save(".scratch/pica-271-orientation.jpg",exif=exif)
