# Original Topology dependencies

Vanta 0.5.24: unmodified `dist/vanta.topology.min.js` from upstream commit
`f8b351906688b56f0fc744e53bde81fc3c56f150`.
https://github.com/tengbao/vanta/tree/f8b351906688b56f0fc744e53bde81fc3c56f150
MIT copyright/permission: ../topology-LICENSE.txt.
Original Topology effect by Kjetil Midtgarden Golid.

p5.js 1.1.9: unmodified distribution from
https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.1.9/p5.min.js
Corresponding full source and build instructions:
https://github.com/processing/p5.js/tree/1.1.9
License: GNU LGPL 2.1, included in p5-LICENSE.txt.
No p5.sound extension is used; no audio capture through p5.

SEKKES wrapper ../topology-original-frame.mjs adds color/simulation-step
response to existing call amplitude, and visibility/resize lifecycle handling.
Original particle count, noise field, particle integration and line drawing
remain in the unchanged upstream effect.

The prior lightweight alternative is preserved as ../topology-visual.mjs,
SHA256 fe01e8e83791f3d472417e905207f85b2df9fb954e2268b9b5c006d25610f35e.
Its source release is 5bb1a447b099fae6fdfbe08b094b02eeff2ce88a.
