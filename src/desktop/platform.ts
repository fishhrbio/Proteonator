import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function computeExecutableName(platform:NodeJS.Platform=process.platform){return platform==='win32'?'ProteonatorCompute.exe':'ProteonatorCompute';}
export function projectPathFromArgument(argument:string,platform:NodeJS.Platform=process.platform):string|null{
 if(argument.startsWith('--'))return null;
 try{const file=argument.startsWith('file:')?fileURLToPath(argument,{windows:platform==='win32'}):argument;if(!/\.(proteonator|proview|ptmw)$/i.test(file))return null;return (platform==='win32'?path.win32:path.posix).resolve(file);}catch{return null;}
}
