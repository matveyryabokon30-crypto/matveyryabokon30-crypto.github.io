// Persistent fibres share the particle field, but cannot drain into its sinks.
// A rotating, overscanned material plane leaves no privileged screen direction.
export const THREAD_GAP=1.7, CLOTH_MARGIN=210;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)};
export class ClothField{
 constructor(width,height){this.resize(width,height);}
 resize(width,height){
  this.width=width;this.height=height;this.extent=Math.hypot(width,height)/2+CLOTH_MARGIN;
  this.cellX=48;this.cellY=38;
  this.cols=Math.ceil(2*this.extent/this.cellX)+3;this.rows=Math.ceil(2*this.extent/this.cellY)+3;
  this.values=new Float32Array(this.cols*this.rows);this.vector=new Float32Array(2);this.temp=new Float32Array(2);
  this.angle=-.72;this.cos=Math.cos(this.angle);this.sin=Math.sin(this.angle);
  this.strands=[];
  // Fixed, gently irregular spacing breaks the screen-aligned interference grid.
  for(let x=-this.extent,i=0;x<=this.extent+THREAD_GAP;i++){
   const light=clamp(.45+.27*Math.sin(i*.0325)+.2*Math.sin(i*.0108+1.7)+.08*(hash(i+800)-.5),0,.999);
   this.strands.push({x,band:Math.floor(light*12)});x+=THREAD_GAP*(.84+.32*hash(i));
  }
 }
 update(field,seconds=0){
  this.angle=-.72+seconds*.008+.32*Math.sin(seconds*.019);
  this.cos=Math.cos(this.angle);this.sin=Math.sin(this.angle);
  const {cols,rows,values,cellX,cellY,cos,sin,extent}=this,limit=cellX*.5;
  for(let row=0;row<rows;row++){
   const v=(row-1)*cellY-extent;
   // Long travelling folds add local freedom as the plane turns. A common
   // offset for each row changes curvature without stretching fibre spacing.
   const fold=36*Math.sin(v/210+.28*Math.sin(seconds*.025))+18*Math.sin(v/340-seconds*.014);
   for(let col=0;col<cols;col++){
    const u=(col-1)*cellX-extent;
    field.sample(this.width/2+u*cos-v*sin+100,this.height/2+u*sin+v*cos+100,this.vector,this.temp);
    const [x,y]=this.vector;
    values[row*cols+col]=fold+130*(x*cos+y*sin)/(Math.hypot(x,y)+.035);
   }
   // The derivative bound survives cubic B-spline interpolation. Threads stay
   // distinct even where the shared particle field forms bright wandering knots.
   for(let col=1;col<cols;col++){const i=row*cols+col;values[i]=clamp(values[i],values[i-1]-limit,values[i-1]+limit);}
   for(let col=cols-2;col>=0;col--){const i=row*cols+col;values[i]=clamp(values[i],values[i+1]-limit,values[i+1]+limit);}
  }
 }
 displacement(x,row){
  const t=(x+this.extent)/this.cellX+1,col=Math.floor(t),f=t-col,a=1-f,base=clamp(row,0,this.rows-1)*this.cols;
  const at=k=>this.values[base+clamp(k,0,this.cols-1)];
  return (a*a*a*at(col-1)+(3*f*f*f-6*f*f+4)*at(col)+(-3*f*f*f+3*f*f+3*f+1)*at(col+1)+f*f*f*at(col+2))/6;
 }
 point(x,row,out){
  const u=x+this.displacement(x,row),v=(row-1)*this.cellY-this.extent;
  out[0]=this.width/2+u*this.cos-v*this.sin;out[1]=this.height/2+u*this.sin+v*this.cos;return out;
 }
 draw(cx,color){
  cx.globalCompositeOperation='source-over';cx.globalAlpha=1;cx.fillStyle='#002222';cx.fillRect(0,0,this.width,this.height);
  cx.save();cx.translate(this.width/2,this.height/2);cx.rotate(this.angle);cx.lineWidth=.8;
  // Cubic B-spline in both axes: no corners in the flow or kinks between fibres.
  const y=row=>(row-1)*this.cellY-this.extent;
  for(let band=0;band<12;band++){
   cx.beginPath();
   for(const strand of this.strands){
    if(strand.band!==band)continue;
    const x=strand.x;let a=x+this.displacement(x,0),b=x+this.displacement(x,1),c=x+this.displacement(x,2);
    cx.moveTo((a+4*b+c)/6,y(1));
    for(let row=1;row<this.rows-2;row++){
     const d=x+this.displacement(x,row+2);
     cx.bezierCurveTo((2*b+c)/3,y(row)+this.cellY/3,(b+2*c)/3,y(row)+2*this.cellY/3,(b+4*c+d)/6,y(row+1));a=b;b=c;c=d;
    }
   }
   cx.strokeStyle=`rgba(${color.join(',')},${.39+band*.027})`;cx.stroke();
  }
  cx.restore();
 }
}
