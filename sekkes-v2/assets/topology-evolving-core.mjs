// AI Marius evolving Topology. Derived from Vanta's particle/flow-field approach.
// Attribution and MIT terms: topology-LICENSE.txt. Original effect: Kjetil Midtgarden Golid.
// Original distributions and UI9.12/UI9.13 implementations remain unchanged.
export const SHAPE_SECONDS=8, COLOR_SECONDS=15, COLOR_TRANSITION=6;
// Alternate colour families: no nine green/teal anchors before the first blue.
// Thirty original anchors alternate with thirty new saturated accents.
export const PALETTE=Object.freeze([
 [137,150,78],  // Olive gold — original
 [52,121,236], // Sapphire — new
 [103,132,230], // Blue — original
 [237,110,136], // Watermelon — new
 [220,101,164], // Rose — original
 [43,186,165], // Lagoon — new
 [56,183,145],  // Emerald — original
 [235,173,82], // Saffron — new
 [221,161,70],  // Amber
 [149,115,242], // Ultraviolet — new
 [165,111,222], // Violet — original
 [61,182,219], // Glacier — new
 [41,184,184],  // Turquoise
 [216,85,109], // Garnet — new
 [212,110,88],  // Copper
 [98,190,126], // Verdant — new
 [125,112,220], // Iris
 [236,147,103], // Terracotta — new
 [46,170,118],  // Jade
 [173,104,212], // Wisteria — new
 [228,138,91],  // Peach — original
 [70,136,216], // Denim — new
 [218,81,181],  // Fuchsia
 [195,183,87], // Antique gold — new
 [65,157,222],  // Azure
 [223,101,191], // Bougainvillea — new
 [215,187,101], // Sand gold — original
 [48,173,141], // Viridian — new
 [36,154,128],  // Malachite
 [229,119,85], // Papaya — new
 [188,137,225], // Lilac
 [107,130,239], // Periwinkle — new
 [190,71,98],   // Ruby
 [78,191,187], // Aquamarine — new
 [84,192,172],  // Sea glass
 [216,151,91], // Cognac — new
 [234,159,104], // Apricot
 [160,108,233], // Heliotrope — new
 [79,116,211],  // Cobalt
 [201,82,147], // Mulberry — new
 [176,183,71],  // Citron silk
 [53,161,213], // Cerulean — new
 [202,106,207], // Orchid
 [155,185,89], // Bamboo — new
 [88,157,99],   // Forest fern
 [233,137,159], // Flamingo — new
 [230,104,117], // Living coral
 [122,111,235], // Electric iris — new
 [55,172,205],  // Cyan — original
 [210,163,103], // Honey — new
 [178,151,83],  // Bronze
 [69,176,150], // Eucalyptus — new
 [143,94,202],  // Amethyst
 [183,118,215], // Mauve — new
 [131,187,82],  // Chartreuse
 [228,114,100], // Persimmon — new
 [211,78,126],  // Raspberry
 [103,170,213], // Cornflower — new
 [224,203,141], // Champagne
 [170,191,108], // Pistachio — new
].map(Object.freeze));
export const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10)};
function hsl(rgb){
 const [r,g,b]=rgb.map(v=>v/255),hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo,l=(hi+lo)/2;
 if(!d)return [0,0,l];
 const h=hi===r?(g-b)/d+(g<b?6:0):hi===g?(b-r)/d+2:(r-g)/d+4;
 return [h/6,d/(1-Math.abs(2*l-1)),l];
}
// Travel around the hue wheel rather than mixing opposing RGBs into grey.
export function blendPalette(a,b,mix){
 if(mix<=0)return [...a];if(mix>=1)return [...b];
 const aa=hsl(a),bb=hsl(b),h=(aa[0]+(((bb[0]-aa[0]+1.5)%1)-.5)*mix+1)%1;
 const sat=aa[1]+(bb[1]-aa[1])*mix,l=aa[2]+(bb[2]-aa[2])*mix;
 const c=(1-Math.abs(2*l-1))*sat,x=c*(1-Math.abs((h*6)%2-1)),m=l-c/2;
 const parts=[[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(h*6)];
 return parts.map(v=>(v+m)*255);
}
export function paletteAt(seconds){
 const t=Math.max(0,seconds),index=Math.floor(t/COLOR_SECONDS)%PALETTE.length;
 const mix=smooth((t%COLOR_SECONDS-(COLOR_SECONDS-COLOR_TRANSITION))/COLOR_TRANSITION);
 return blendPalette(PALETTE[index],PALETTE[(index+1)%PALETTE.length],mix);
}
export const SCENE_PROGRESS_KEY='sekkes:topology:progress:v1';
export class SceneClock{
 constructor(seconds=0){this.seconds=Number.isFinite(seconds)&&seconds>=0&&seconds<=31536000?seconds:0;this.previous=null;}
 pause(){this.previous=null;}
 tick(now){const dt=this.previous===null?0:Math.max(0,(now-this.previous)/1000);this.previous=now;this.seconds+=dt;return Math.min(.08,dt);}
}
// Decorative active-time progress only: no audio, account or personal data.
export function restoreSceneClock(storage){
 try{return new SceneClock(Number(storage?.getItem(SCENE_PROGRESS_KEY)||0))}catch{return new SceneClock()}
}
export function saveSceneClock(storage,clock){
 try{if(!storage)return false;storage.setItem(SCENE_PROGRESS_KEY,String(Math.max(clock.seconds,restoreSceneClock(storage).seconds)));return true}catch{return false}
}
// Keep a sharp backing store on Retina screens without unbounded canvas memory.
export function renderDensity(dpr,width,height,cssWidth=width){return Math.max(1,Math.min(3,Math.max(2,(Number.isFinite(dpr)?dpr:1)*cssWidth/width),Math.sqrt(6000000/(width*height))));}
export function geometry(width,height){const scale=Math.min(1,850/width,1200/height);return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};}
// Same minimum-to-maximum noise-gradient principle as the original, sampled
// at eight directions on a coarser lattice and interpolated between epochs.
export function makeField(noise,width,height,epoch){
 const cell=20,cols=Math.ceil((width+200)/cell)+1,rows=Math.ceil((height+200)/cell)+1;
 const values=new Float32Array(cols*rows*2),z=epoch*.43;
 const radius=.1,scale=.00046;
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  let low=Infinity,high=-Infinity,lx=0,ly=0,hx=0,hy=0;
  for(let k=0;k<8;k++){
   const angle=k*Math.PI/4,dx=Math.cos(angle),dy=Math.sin(angle);
   const value=noise(x*cell*scale+dx*radius+z*.31,y*cell*scale+dy*radius+z*.17,z);
   if(value<low){low=value;lx=dx;ly=dy;}if(value>high){high=value;hx=dx;hy=dy;}
  }
  const dx=lx-hx,dy=ly-hy,length=Math.hypot(dx,dy)||1,i=(y*cols+x)*2;
  values[i]=dx/length*(high-low);values[i+1]=dy/length*(high-low);
 }
 return {values,cell,cols,rows};
}
export function sampleField(field,x,y,out){
 const gx=Math.max(0,Math.min(field.cols-1.001,x/field.cell)),gy=Math.max(0,Math.min(field.rows-1.001,y/field.cell));
 const ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy,i=(iy*field.cols+ix)*2,a=field.values;
 for(let k=0;k<2;k++)out[k]=(a[i+k]*(1-fx)+a[i+2+k]*fx)*(1-fy)+(a[i+field.cols*2+k]*(1-fx)+a[i+field.cols*2+2+k]*fx)*fy;
 return out;
}
export class FlowField{
 constructor(noise,width,height,seconds=0){this.noise=noise;this.resize(width,height,seconds);}
 resize(width,height,seconds){this.width=width;this.height=height;this.epoch=Math.floor(seconds/SHAPE_SECONDS);this.a=makeField(this.noise,width,height,this.epoch);this.b=makeField(this.noise,width,height,this.epoch+1);this.mix=smooth(seconds/SHAPE_SECONDS-this.epoch);}
 advance(seconds){const epoch=Math.floor(seconds/SHAPE_SECONDS);if(epoch!==this.epoch){this.a=epoch===this.epoch+1?this.b:makeField(this.noise,this.width,this.height,epoch);this.b=makeField(this.noise,this.width,this.height,epoch+1);this.epoch=epoch;}this.mix=smooth(seconds/SHAPE_SECONDS-epoch);}
 sample(x,y,out,temp){sampleField(this.a,x,y,out);sampleField(this.b,x,y,temp);out[0]+=(temp[0]-out[0])*this.mix;out[1]+=(temp[1]-out[1])*this.mix;return out;}
}

