// SEKKES evolving Topology. Derived from Vanta's particle/flow-field approach.
// Original distributions and UI9.12/UI9.13 implementations remain unchanged.
export const SHAPE_SECONDS=10, COLOR_SECONDS=100, COLOR_TRANSITION=10;
export const PALETTE=Object.freeze([[137,150,78],[56,183,145],[55,172,205],[103,132,230],[165,111,222],[220,101,164],[228,138,91],[215,187,101]].map(Object.freeze));
export const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10)};
export function paletteAt(seconds){
 const t=Math.max(0,seconds),index=Math.floor(t/COLOR_SECONDS)%PALETTE.length;
 const mix=smooth((t%COLOR_SECONDS-(COLOR_SECONDS-COLOR_TRANSITION))/COLOR_TRANSITION);
 return PALETTE[index].map((v,i)=>v+(PALETTE[(index+1)%PALETTE.length][i]-v)*mix);
}
export class SceneClock{
 constructor(){this.seconds=0;this.previous=null;}
 pause(){this.previous=null;}
 tick(now){const dt=this.previous===null?0:Math.max(0,Math.min(.08,(now-this.previous)/1000));this.previous=now;this.seconds+=dt;return dt;}
}
export function geometry(width,height){const scale=Math.min(1,850/width,1200/height);return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};}
// Same minimum-to-maximum noise-gradient principle as the original, sampled
// at eight directions on a coarser lattice and interpolated between epochs.
export function makeField(noise,width,height,epoch){
 const cell=20,cols=Math.ceil((width+200)/cell)+1,rows=Math.ceil((height+200)/cell)+1;
 const values=new Float32Array(cols*rows*2),z=epoch*.43;
 const radius=.1,scale=.0012;
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
