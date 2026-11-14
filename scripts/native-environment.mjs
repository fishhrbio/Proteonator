import electron from 'electron';import path from 'node:path';
export const electronExecutable=electron;
export const systemPath=process.platform==='win32'?(process.env.SystemRoot??'C:\\Windows')+'\\System32':'/usr/bin:/bin:/usr/sbin:/sbin';
export const softwareGraphicsArgs=process.env.PROTEONATOR_VERIFY_SOFTWARE_GL==='1'?['--use-gl=angle','--use-angle=swiftshader']:[];
export const computeName=process.platform==='win32'?'ProteonatorCompute.exe':'ProteonatorCompute';
export function resourcesForExecutable(executable){return process.platform==='darwin'?path.resolve(path.dirname(executable),'..','Resources'):path.join(path.dirname(executable),'resources');}
