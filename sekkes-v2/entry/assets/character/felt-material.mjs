// Continuous object-space short velour. No UV seams or screen-space swimming.
export function feltShader(shader) {
 shader.vertexShader='varying vec3 vFelt;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFelt=position;');
 shader.fragmentShader=`varying vec3 vFelt;
 float feltHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
 float feltNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(feltHash(i),feltHash(i+vec3(1,0,0)),f.x),mix(feltHash(i+vec3(0,1,0)),feltHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(feltHash(i+vec3(0,0,1)),feltHash(i+vec3(1,0,1)),f.x),mix(feltHash(i+vec3(0,1,1)),feltHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 // Fade unresolved fibres instead of flickering when the character is small.
 float feltLayer(vec3 p){float footprint=max(length(dFdx(p)),length(dFdy(p)));return mix(.5,feltNoise(p),1.-smoothstep(.7,2.2,footprint));}
 vec3 feltNormal(vec3 surf,vec3 n,float height){vec3 dx=dFdx(surf),dy=dFdy(surf);vec3 r1=cross(dy,n),r2=cross(n,dx);float det=dot(dx,r1);vec3 gradient=sign(det)*(dFdx(height)*r1+dFdy(height)*r2);return normalize(abs(det)*n-gradient);}
 `+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float nap=.60*feltLayer(vFelt*220.)+.28*feltLayer(vFelt*430.)+.12*feltLayer(vFelt*vec3(580.,260.,580.));
 float cloud=feltNoise(vFelt*24.);
 diffuseColor.rgb*=1.+.28*(nap-.5)+.035*(cloud-.5);`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 float objectPixel=max(length(dFdx(vFelt)),length(dFdy(vFelt)));
 float viewPixel=max(length(dFdx(vViewPosition)),length(dFdy(vViewPosition)));
 float napHeight=(nap-.5)*.0028*viewPixel/max(objectPixel,.000001);
 normal=feltNormal(-vViewPosition,normal,napHeight);`);
}
export function setFeltProperties(material){
 material.roughness=.94;material.metalness=0;material.transmission=0;material.thickness=0;
 material.clearcoat=0;material.specularIntensity=.22;material.envMapIntensity=.20;
 material.sheen=.72;material.sheenRoughness=.90;material.sheenColor.copy(material.color).lerp({r:1,g:1,b:1},.22);
 material.bumpMap=null;material.bumpScale=0;
}
export function applyFelt(material){setFeltProperties(material);material.onBeforeCompile=feltShader;material.customProgramCacheKey=()=> 'marius-short-velour-v62';material.needsUpdate=true;return material;}
