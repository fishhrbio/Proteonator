import {z} from 'zod';
export const LocalResponseSettings=z.object({forcefield:z.enum(['charmm36_2024.xml','charmm36.xml']),pH:z.number().finite().min(0).max(14),radiusAngstrom:z.number().finite().min(4).max(20),restraintK:z.number().finite().min(1).max(10000),maxIterations:z.int().min(1).max(1000),tolerance:z.number().finite().min(.1).max(1000),seed:z.int().min(0).max(2147483647)}).strict();
export function localResponseFromFields(fields:Record<string,string>){
 const values:Record<string,unknown>={forcefield:fields.forcefield};
 for(const key of ['pH','radiusAngstrom','restraintK','maxIterations','tolerance','seed']){if(!fields[key]?.trim())throw new Error('Enter a value for '+key+' before saving or calculating a local response.');values[key]=Number(fields[key]);}
 const result=LocalResponseSettings.safeParse(values);if(!result.success)throw new Error('Review local-response settings: '+result.error.issues.map(i=>i.path.join('.')+' '+i.message).join('; '));return result.data;
}
