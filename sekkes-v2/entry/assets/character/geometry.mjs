// Exact v62 shell, inward roundover and face geometry extracted from the repository master.
import * as THREE from './vendor/three.module.mjs?v=ce1fa418de16a19495a9f72495580e3015d7745c296d3ce0485897f902ddedfb';
import {faceRadius,faceSurfaceZ,faceDepth,rimWidth,seamSegments,rimPoint} from './face-shape.mjs?v=d40acec5fc16253b0ce7cc92b32dd3ab2f9d2e8f2fac2f3eab26d134f327f644';
export function createHeadGeometry(glass,faceMat){
 const actor=new THREE.Group();
function makeShell(){const p=[],uv=[],ix=[],N=seamSegments,R=80;
 for(let j=0;j<=R;j++)for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,c=Math.cos(a),sn=Math.sin(a),r=faceRadius(a)+rimWidth,theta=Math.asin(r)+(Math.PI-Math.asin(r))*j/R;p.push(Math.sin(theta)*c,Math.sin(theta)*sn,Math.cos(theta));uv.push(i/N,j/R);if(j<R&&i<N){const k=j*(N+1)+i;ix.push(k,k+N+1,k+1,k+1,k+N+1,k+N+2);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;}
const sphere=makeShell(),body=new THREE.Mesh(sphere,glass);actor.add(body);const rest=sphere.attributes.position.array.slice();
function makeLip(){const p=[],uv=[],ix=[],N=seamSegments,R=32;
 for(let j=0;j<=R;j++)for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,c=Math.cos(a),sn=Math.sin(a),k=j/R;const [x,y,z]=rimPoint(a,k);p.push(x,y,z);uv.push(i/N,k);if(j<R&&i<N){const n=j*(N+1)+i;ix.push(n,n+1,n+N+1,n+1,n+N+2,n+N+1);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;}
const lipGeometry=makeLip(),lipRest=lipGeometry.attributes.position.array.slice();
// Subtle contact shading belongs to the inward turn, rather than a raised ring.
const lipColors=[];for(let j=0;j<=32;j++)for(let i=0;i<=seamSegments;i++){const k=j/32,v=1-.66*Math.pow(Math.max(0,(k-.78)/.22),2);lipColors.push(v,v,v);}lipGeometry.setAttribute('color',new THREE.Float32BufferAttribute(lipColors,3));
const rimShading={value:1};const lipMaterial=glass.clone();lipMaterial.vertexColors=true;const lip=new THREE.Mesh(lipGeometry,lipMaterial);actor.add(lip);
const faceGeo=new THREE.BufferGeometry(),pos=[],uv=[],idx=[];const rings=32,segments=seamSegments;
for(let r=0;r<=rings;r++)for(let a=0;a<=segments;a++){const t=a/segments*Math.PI*2,k=r/rings,rb=faceRadius(t),x=rb*k*Math.cos(t),y=rb*k*Math.sin(t);pos.push(x,y,faceSurfaceZ(x,y));uv.push(x/1.5+.5,y/1.04+.5);if(r<rings&&a<segments){const i=r*(segments+1)+a;idx.push(i,i+segments+1,i+1,i+1,i+segments+1,i+segments+2);}}
faceGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));faceGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));faceGeo.setIndex(idx);faceGeo.computeVertexNormals();const face=new THREE.Mesh(faceGeo,faceMat);face.renderOrder=1;actor.add(face);

return {actor,body,lip,face};
}
