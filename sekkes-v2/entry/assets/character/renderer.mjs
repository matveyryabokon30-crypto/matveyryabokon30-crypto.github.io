import * as THREE from './vendor/three.module.mjs?v=ce1fa418de16a19495a9f72495580e3015d7745c296d3ce0485897f902ddedfb';
import {createHeadGeometry} from './geometry.mjs?v=413d763226b58a48b5425b3af23c449fe79c266cad41190432763583c71c3e49';
import {faceSurfaceZ} from './face-shape.mjs?v=d40acec5fc16253b0ce7cc92b32dd3ab2f9d2e8f2fac2f3eab26d134f327f644';
import {applyFelt} from './felt-material.mjs?v=bf279a2198f766e472e3083bd8d9d9b32a3678b18f8978ef67c9283ca9f4dffa';

// Repository v62 model, rendered on an alpha canvas. No photographic stage or frame.
export function mountHead(host,{color='#aebbed',motion=true,minimumResolution=0,pointerTracking=true,onPortrait=()=>{}}={}){
  const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Живая объёмная голова Мариуса');host.append(canvas);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
  renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,30);camera.position.set(0,.06,4.8);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xffffff,0x727c9a,2.1));const key=new THREE.DirectionalLight(0xfff5ec,3);key.position.set(-3,4,5);scene.add(key);const fill=new THREE.DirectionalLight(0xd6e5ff,1.6);fill.position.set(3,1,2);scene.add(fill);
  const material=applyFelt(new THREE.MeshPhysicalMaterial({color}));
  const faceMaterial=new THREE.MeshPhysicalMaterial({color:0x10151d,roughness:.5,metalness:0,clearcoat:.08});
  const {actor,body,lip,face}=createHeadGeometry(material,faceMaterial);applyFelt(lip.material);scene.add(actor);
  const eyeMaterial=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});
function screenEyeGeometry(){const g=new THREE.BufferGeometry(),p=[],idx=[];const N=96,R=12;for(let j=0;j<=R;j++)for(let i=0;i<=N;i++){const a=i/N*Math.PI*2;p.push(j/R*Math.cos(a),j/R*Math.sin(a),0);if(j<R&&i<N){const k=j*(N+1)+i;idx.push(k,k+N+1,k+1,k+1,k+N+1,k+N+2);}}g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;}
  const eyes=[-1,1].map(sign=>{const g=screenEyeGeometry(),e=new THREE.Mesh(g,eyeMaterial);e.userData.sign=sign;actor.add(e);return e;});
  let frame=0,visible=true,disposed=false,last=0,time=0,px=0,py=0,gx=0,gy=0,portrait=true,enabled=motion,measured=false,width=0,height=0,density=0;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  function resize(){
    // Layout dimensions deliberately exclude CSS transforms. A morph must never
    // resize/clear the drawing buffer on every animation frame.
    const w=host.clientWidth,h=host.clientHeight;measured=!!(w&&h);if(!measured)return;
    const ratio=Math.min(minimumResolution?4:2,Math.max(devicePixelRatio||1,minimumResolution/Math.max(w,h)));
    if(w!==width||h!==height||ratio!==density){width=w;height=h;density=ratio;renderer.setDrawingBufferSize(w,h,ratio);camera.aspect=w/h;camera.updateProjectionMatrix();}
    request();
  }
  function paint(now){frame=0;if(disposed||!visible||!measured||document.hidden)return;const delta=Math.min(.04,(now-last)/1000||.016);last=now;if(enabled&&!reduced.matches)time+=delta;gx+=(px-gx)*.09;gy+=(py-gy)*.09;
    const animate=enabled&&!reduced.matches,phase=time%5.7,blink=animate&&phase>4.9&&phase<5.12?Math.max(.05,Math.abs((phase-5.01)/.11)):1;
    actor.rotation.set(animate?gy*.10+Math.sin(time*.7)*.028:0,animate?gx*.2+Math.sin(time*.43)*.11:0,animate?Math.sin(time*.55)*.025:0);actor.position.y=animate?Math.sin(time*1.1)*.045:0;
    for(const eye of eyes){const x=eye.userData.sign*.342+(animate?gx*.055:0),y=animate?gy*.035:0;eye.position.set(x,y,faceSurfaceZ(x,y)+.008);eye.scale.set(.092,Math.max(.012,.203*blink),1);const points=eye.geometry.attributes.position;for(let i=0;i<points.count;i++){const xx=x+points.getX(i)*eye.scale.x,yy=y+points.getY(i)*eye.scale.y;points.setZ(i,faceSurfaceZ(xx,yy)+.006-eye.position.z);}points.needsUpdate=true;}
    renderer.render(scene,camera);
    if(portrait){portrait=false;onPortrait(canvas.toDataURL('image/png'));}
    if(animate)frame=requestAnimationFrame(paint);
  }
  function request(){if(!frame&&!disposed&&visible&&!document.hidden)frame=requestAnimationFrame(paint);}
  const observe=new ResizeObserver(resize);observe.observe(host);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)request();else {cancelAnimationFrame(frame);frame=0;}});intersection.observe(host);
  function pointer(e){const r=host.getBoundingClientRect();px=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/(r.width/2)));py=Math.max(-1,Math.min(1,-(e.clientY-r.top-r.height/2)/(r.height/2)));request();}
  function visibility(){if(document.hidden){cancelAnimationFrame(frame);frame=0;}else request();}
  if(pointerTracking)document.addEventListener('pointermove',pointer,{passive:true});document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',request);resize();
  return {setColor(value){material.color.set(value);applyFelt(material);lip.material.color.set(value);applyFelt(lip.material);portrait=true;request();},setMotion(value){enabled=value;request();},destroy(){disposed=true;cancelAnimationFrame(frame);observe.disconnect();intersection.disconnect();document.removeEventListener('pointermove',pointer);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',request);actor.traverse(n=>{n.geometry?.dispose();});material.dispose();lip.material.dispose();faceMaterial.dispose();eyeMaterial.dispose();renderer.dispose();canvas.remove();}};
}
