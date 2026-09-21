// Original SEKKES particle choreography, inspired by the owner's Thinking Orbs
// reference. Canvas dots preserve semantic glyphs while exploring 3D forms.
export function iconSeed(name){let n=17;for(const c of name)n=(n*31+c.charCodeAt(0))>>>0;return (n%10007)/10007;}
export function iconMode(name){
 if(['record','mic','sound'].includes(name))return 'wave';
 if(['world','profile','community'].includes(name))return 'globe';
 if(['settings','feed','photo','carousel','copy'].includes(name))return 'cube';
 if(['games','send','play','arrow','back'].includes(name))return 'prism';
 return 'orbit';
}
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
export function iconFrame(anchors,seconds,{name='spark',phase=0,freedom=.38,impulse=0,reduced=false}={},out=new Float32Array(anchors.length/2*4)){
 const count=anchors.length/2,seed=iconSeed(name),mode=iconMode(name),t=seconds+phase+seed*19;
 // Stay assembled most of the cycle. The bloom and return have zero velocity
 // at either endpoint; phase offsets stop all buttons dissolving together.
 const bloom=ease((Math.sin(t*.43)-.05)/.95),mix=reduced?0:Math.min(.88,freedom*bloom);
 const yaw=t*.32,tilt=.36*Math.sin(t*.21),cy=Math.cos(yaw),sy=Math.sin(yaw),ct=Math.cos(tilt),st=Math.sin(tilt);
 const breathing=reduced?1:1+.025*Math.sin(t*.91)+impulse*.055;
 for(let i=0;i<count;i++){
  const a=i*2,at=i*4,f=(i+.5)/count,angle=i*2.399963229728653;
  let z=1-2*f,r=Math.sqrt(Math.max(0,1-z*z)),x=r*Math.cos(angle),y=r*Math.sin(angle);
  if(mode==='wave'||mode==='orbit'){
   const ring=i%3,theta=Math.floor(i/3)/Math.ceil(count/3)*Math.PI*2;
   r=.76+.12*Math.sin(theta*3+t*.8+ring);
   x=r*Math.cos(theta);y=r*Math.sin(theta);z=(ring-1)*.38;
   if(mode==='wave')y+=.18*Math.sin(theta*2-t*1.3+ring*.7);
  }else if(mode==='cube'){
   const edge=i%12,u=2*((Math.floor(i/12)+.5)/Math.ceil(count/12))-1;
   if(edge<4){x=u;y=edge%2?1:-1;z=edge<2?-1:1;}
   else if(edge<8){x=edge%2?1:-1;y=u;z=edge<6?-1:1;}
   else{x=edge%2?1:-1;y=edge<10?-1:1;z=u;}
   x*=.68;y*=.68;z*=.68;
  }else if(mode==='prism'){
   const side=i%3,u=(Math.floor(i/3)+.5)/Math.ceil(count/3),a0=side*Math.PI*2/3-Math.PI/2,a1=a0+Math.PI*2/3;
   x=(1-u)*Math.cos(a0)+u*Math.cos(a1);y=(1-u)*Math.sin(a0)+u*Math.sin(a1);z=.24*Math.sin(angle+t*.5);
  }
  const xx=x*cy+z*sy,zz=-x*sy+z*cy,yy=y*ct-zz*st,depth=y*st+zz*ct;
  const ax=anchors[a]-12,ay=anchors[a+1]-12;
  const flow=reduced?0:.16*Math.sin(t*.9+i*.71)+impulse*.34*Math.sin(angle);
  out[at]=12+(ax*(1-mix)+xx*7.5*mix)*breathing+flow;
  out[at+1]=12+(ay*(1-mix)+yy*7.5*mix)*breathing+(reduced?0:.14*Math.cos(t*.8+i*.61));
  out[at+2]=reduced?.52:.48+.12*(depth+1)/2+impulse*.055;
  out[at+3]=reduced?.96:Math.max(.3,Math.min(1,.92+depth*mix*.28));
 }
 return out;
}
