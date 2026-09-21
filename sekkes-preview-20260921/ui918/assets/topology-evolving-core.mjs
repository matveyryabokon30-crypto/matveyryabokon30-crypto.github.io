// SEKKES evolving Topology. Derived from Vanta's particle/flow-field approach.
// Attribution and MIT terms: topology-LICENSE.txt. Original effect: Kjetil Midtgarden Golid.
// Original distributions and UI9.12/UI9.13 implementations remain unchanged.
export const SHAPE_SECONDS=10, COLOR_SECONDS=100, COLOR_TRANSITION=10;
// Thirty rich anchors arranged as one continuous colour journey. The original
// eight RGB values are preserved; each anchor still owns the same 100s interval.
export const PALETTE=Object.freeze([
 [137,150,78],  // Olive gold — original
 [176,183,71],  // Citron silk
 [131,187,82],  // Chartreuse
 [88,157,99],   // Forest fern
 [46,170,118],  // Jade
 [56,183,145],  // Emerald — original
 [36,154,128],  // Malachite
 [84,192,172],  // Sea glass
 [41,184,184],  // Turquoise
 [55,172,205],  // Cyan — original
 [65,157,222],  // Azure
 [79,116,211],  // Cobalt
 [103,132,230], // Blue — original
 [125,112,220], // Iris
 [143,94,202],  // Amethyst
 [165,111,222], // Violet — original
 [188,137,225], // Lilac
 [202,106,207], // Orchid
 [218,81,181],  // Fuchsia
 [220,101,164], // Rose — original
 [211,78,126],  // Raspberry
 [190,71,98],   // Ruby
 [230,104,117], // Living coral
 [212,110,88],  // Copper
 [228,138,91],  // Peach — original
 [234,159,104], // Apricot
 [221,161,70],  // Amber
 [215,187,101], // Sand gold — original
 [224,203,141], // Champagne
 [178,151,83],  // Bronze
].map(Object.freeze));
export const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10)};
export function paletteAt(seconds){
 const t=Math.max(0,seconds),index=Math.floor(t/COLOR_SECONDS)%PALETTE.length;
 const mix=smooth((t%COLOR_SECONDS-(COLOR_SECONDS-COLOR_TRANSITION))/COLOR_TRANSITION);
 return PALETTE[index].map((v,i)=>v+(PALETTE[(index+1)%PALETTE.length][i]-v)*mix);
}
export class SceneClock{
 constructor(){this.seconds=0;this.previous=null;}
 pause(){this.previous=null;}
 tick(now){const dt=this.previous===null?0:Math.max(0,(now-this.previous)/1000);this.previous=now;this.seconds+=dt;return Math.min(.08,dt);}
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
