import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const linear=value=>{const n=parseInt(value,16)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;};
const luminance=color=>.2126*linear(color.slice(1,3))+.7152*linear(color.slice(3,5))+.0722*linear(color.slice(5,7));
const ratio=(a,b)=>{const [light,dark]=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (light+.05)/(dark+.05);};
const checks=[
  {target:'Muted text over the lightest molecular-panel gradient (heading, motion, clipping and captions)',foreground:'#a2b2c6',background:'#1a2b3b',minimum:4.5},
  {target:'Main title over the lightest gradient',foreground:'#edf3fa',background:'#1a2b3b',minimum:4.5},
  {target:'Status separators',foreground:'#a2b2c6',background:'#0b121c',minimum:4.5},
  {target:'Form/control borders against control background',foreground:'#60758c',background:'#172233',minimum:3},
  {target:'Pressed representation and keyboard-focus outline',foreground:'#64ddca',background:'#203b40',minimum:3},
  {target:'Selected residue text',foreground:'#ffd28b',background:'#564225',minimum:4.5},
];
for(const c of checks){c.ratio=ratio(c.foreground,c.background);assert.ok(c.ratio>=c.minimum);}
await mkdir(new URL('../evidence/',import.meta.url),{recursive:true});await writeFile(new URL('../evidence/manual-contrast.json',import.meta.url),JSON.stringify({status:'passed',method:'WCAG sRGB relative luminance; manual resolution of gradient-background cases marked incomplete by axe, plus explicit control-boundary and selected-state checks. Header and tool text lie outside the molecular canvas.',checks},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length}));
