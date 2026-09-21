// Persistent material from the same field as the moving particles.
// A bounded displacement lattice keeps neighbouring threads apart even at sinks.
export const THREAD_GAP=1.5, CLOTH_MARGIN=150;
export class ClothField{
 constructor(width,height){this.resize(width,height);}
 resize(width,height){this.width=width;this.height=height;this.cellX=36;this.cellY=28;this.cols=Math.ceil((width+2*CLOTH_MARGIN)/this.cellX)+1;this.rows=Math.ceil((height+2*CLOTH_MARGIN)/this.cellY)+1;this.values=new Float32Array(this.cols*this.rows);this.vector=new Float32Array(2);this.temp=new Float32Array(2);}
 update(field){
  const {cols,rows,values,cellX,cellY}=this,limit=cellX*.55;
  for(let row=0;row<rows;row++){
   for(let col=0;col<cols;col++){
    field.sample(col*cellX-CLOTH_MARGIN+100,row*cellY-CLOTH_MARGIN+100,this.vector,this.temp);
    const [x,y]=this.vector;values[row*cols+col]=110*(x+.25*y)/(Math.hypot(x,y)+.035);
   }
   for(let col=1;col<cols;col++){const i=row*cols+col;values[i]=Math.max(values[i-1]-limit,Math.min(values[i-1]+limit,values[i]));}
   for(let col=cols-2;col>=0;col--){const i=row*cols+col;values[i]=Math.max(values[i+1]-limit,Math.min(values[i+1]+limit,values[i]));}
  }
 }
 displacement(x,row){const t=(x+CLOTH_MARGIN)/this.cellX,col=Math.max(0,Math.min(this.cols-2,Math.floor(t))),mix=Math.max(0,Math.min(1,t-col)),i=row*this.cols+col;return this.values[i]*(1-mix)+this.values[i+1]*mix;}
 draw(cx,color){
  cx.globalCompositeOperation='source-over';cx.globalAlpha=1;cx.fillStyle='#002222';cx.fillRect(0,0,this.width,this.height);
  const count=Math.ceil((this.width+2*CLOTH_MARGIN)/THREAD_GAP);
  // Stable brightness bands give the material fine fibres and broad ribbons.
  for(let band=0;band<6;band++){
   cx.beginPath();
   for(let strand=0;strand<count;strand++){
    const luminance=(Math.sin(strand*.061)+Math.sin(strand*.019+1.7)+2)/4;
    if(Math.min(5,Math.floor(luminance*6))!==band)continue;
    const x=strand*THREAD_GAP-CLOTH_MARGIN;
    let px=x+this.displacement(x,0),py=-CLOTH_MARGIN;cx.moveTo(px,py);
    for(let row=1;row<this.rows;row++){
     const nx=x+this.displacement(x,row),ny=row*this.cellY-CLOTH_MARGIN;
     cx.quadraticCurveTo(px,py,(px+nx)*.5,(py+ny)*.5);px=nx;py=ny;
    }
    cx.lineTo(px,py);
   }
   cx.lineWidth=.82;cx.strokeStyle=`rgba(${color.join(',')},${.38+band*.055})`;cx.stroke();
  }
 }
}
