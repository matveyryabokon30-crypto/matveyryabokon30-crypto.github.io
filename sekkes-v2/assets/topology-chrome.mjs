// Native browser chrome is not an animation surface. Keep theme-color stable;
// the installed app shows the actual scene through one translucent safe-area layer.
export const INITIAL_CHROME='#1e3c2c';
export function mountTopologyChrome(doc){
 if(!doc.body?.append)return {dispose(){}};
 const edge=doc.createElement('div');
 edge.id='topologyChrome';edge.className='topology-chrome-edge';
 edge.setAttribute('aria-hidden','true');doc.body.append(edge);
 return {dispose(){edge.remove()}};
}
