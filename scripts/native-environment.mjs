import electron from 'electron';import path from 'node:path';
export const electronExecutable=electron;
export const systemPath=process.platform==='win32'?(process.env.SystemRoot??'C:\\Windows')+'\\System32':'/usr/bin:/bin:/usr/sbin:/sbin';
export const graphicsModes={native:[],metal:['--use-angle=metal'],'swiftshader-webgl':['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader'],swiftshader:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],'angle-gl':['--use-gl=angle','--use-angle=gl'],'software-gl':['--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist'],'swiftshader-vulkan':['--use-gl=angle','--use-angle=swiftshader','--use-vulkan=swiftshader','--enable-unsafe-swiftshader']};
export const softwareGraphicsArgs=graphicsModes[process.env.PROTEONATOR_VERIFY_GL_MODE]??(process.env.PROTEONATOR_VERIFY_SOFTWARE_GL==='1'?['--use-gl=angle','--use-angle=swiftshader']:[]);
export const computeName=process.platform==='win32'?'ProteonatorCompute.exe':'ProteonatorCompute';
export function resourcesForExecutable(executable){return process.platform==='darwin'?path.resolve(path.dirname(executable),'..','Resources'):path.join(path.dirname(executable),'resources');}
