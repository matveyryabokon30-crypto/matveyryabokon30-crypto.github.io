import {ImageMagick,initializeImageMagick,MagickFormat,MagickImageInfo,MagickReadSettings} from 'npm:@imagemagick/magick-wasm@0.0.30';
let ready:Promise<void>|null=null;let serial:Promise<unknown>=Promise.resolve();
function init(){return ready ||= (async()=>{const b=await Deno.readFile(new URL('magick.wasm',import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.30')));await initializeImageMagick(b);})();}
function animated(bytes:Uint8Array,mime:string){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(mime==='image/png'){for(let i=8;i+12<=bytes.length;){const n=dv.getUint32(i),type=String.fromCharCode(...bytes.subarray(i+4,i+8));if(type==='acTL')return true;if(type==='IDAT')break;if(n>bytes.length-i-12)break;i+=12+n;}}
 if(mime==='image/webp'){for(let i=12;i+8<=bytes.length;){const n=dv.getUint32(i+4,true),type=String.fromCharCode(...bytes.subarray(i,i+4));if(type==='ANIM'||type==='ANMF')return true;if(n>bytes.length-i-8)break;i+=8+n+(n%2);}}
 return false;
}
export function derivatives(bytes:Uint8Array,mime:string):Promise<{size:number,bytes:Uint8Array,width:number,height:number}[]>{
 const work=serial.catch(()=>{}).then(async()=>{
  if(bytes.length>16*1024*1024||!['image/jpeg','image/png','image/webp'].includes(mime)||animated(bytes,mime))throw Error('unsupported_source');
  await init();const info=MagickImageInfo.create(bytes),pixels=info.width*info.height;
  const actual=String(info.format).toUpperCase(),expected=mime==='image/jpeg'?'JPEG':mime==='image/png'?'PNG':'WEBP';
  if(actual!==expected)throw Error('unsupported_source');
  if(!info.width||!info.height||pixels>(mime==='image/jpeg'?50_000_000:10_000_000))throw Error('image_dimensions_limit');
  const settings=new MagickReadSettings();if(mime==='image/jpeg')settings.setDefine(MagickFormat.Jpeg,'size','1600x1600');
  return ImageMagick.read(bytes,settings,image=>{
   image.autoOrient();const result=[];
   // Keep ICC profiles rather than silently changing display-P3 colours.
   for(const size of [1600,960,192]){
    if(Math.max(image.width,image.height)>size){if(image.width>=image.height)image.resize(size,0);else image.resize(0,size);}
    image.quality=size===1600?82:80;image.settings.setDefine(MagickFormat.WebP,'method','1');
    const output=image.write(MagickFormat.WebP,data=>new Uint8Array(data));if(output.byteLength>4*1024*1024)throw Error('preview_size_limit');
    result.push({size,bytes:output,width:image.width,height:image.height});
   }return result;
  });
 });serial=work;return work;
}
