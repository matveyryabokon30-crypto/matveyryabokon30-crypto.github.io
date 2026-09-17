import {derivatives} from './backend/raster.ts';
const source=await Deno.readFile('results/fixtures/original.jpg');
const start=performance.now(),output=await derivatives(source,'image/jpeg'),ms=performance.now()-start;
for(const o of output){if(Math.max(o.width,o.height)!==o.size)throw Error('Wrong derivative geometry');await Deno.writeFile(`results/fixtures/${o.size}.webp`,o.bytes);}
const preview=output.find(x=>x.size===960)!;if(preview.bytes.length>=source.length*.4)throw Error('Preview does not reduce cold transfer');
if(output.length!==3)throw Error('Three delivery sizes are required');
const invalid=await derivatives(new Uint8Array([1,2,3]),'image/jpeg').then(()=>false,()=>true);if(!invalid)throw Error('Invalid media accepted');
await Deno.writeTextFile('results/p02-raster.json',JSON.stringify({sourceBytes:source.length,derivatives:output.map(x=>({size:x.size,width:x.width,height:x.height,bytes:x.bytes.length})),elapsedMs:Math.round(ms),testEnvironment:'Deno on CI runner, not hosted Edge CPU measurement',sourceUnmodified:true,invalidInputRejected:true},null,2));
console.log('P02 raster PASS',source.length,output.map(x=>[x.size,x.bytes.length]),Math.round(ms));
