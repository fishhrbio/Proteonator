import {Task} from 'molstar/lib/mol-task';
import {InteractionsRepresentationProvider} from 'molstar/lib/mol-model-props/computed/representations/interactions';
import {InteractionsProvider} from 'molstar/lib/mol-model-props/computed/interactions';
import {ParamDefinition} from 'molstar/lib/mol-util/param-definition';
import {PluginContext} from 'molstar/lib/mol-plugin/context';
import {DefaultPluginSpec} from 'molstar/lib/mol-plugin/spec';
import {StructureElement} from 'molstar/lib/mol-model/structure';
import {Vec3,Mat4} from 'molstar/lib/mol-math/linear-algebra';
import {applyStructureInteractivity} from 'molstar/lib/extensions/plugin/interactivity';
import {loadVolumeFromUrl} from 'molstar/lib/extensions/plugin/loaders';
import {Color} from 'molstar/lib/mol-util/color';
import {setSubtreeVisibility} from 'molstar/lib/mol-plugin/behavior/static/state';
import {StateTransforms} from 'molstar/lib/mol-plugin-state/transforms';
import {createVolumeRepresentationParams} from 'molstar/lib/mol-plugin-state/helpers/volume-representation-params';
import {Volume} from 'molstar/lib/mol-model/volume';
import {createStructureRepresentationParams} from 'molstar/lib/mol-plugin-state/helpers/structure-representation-params';
class LocalViewer {
 readonly plugin:PluginContext;
 private resize:ResizeObserver;
 static instances:LocalViewer[]=[];
 private constructor(plugin:PluginContext,parent:HTMLElement){this.plugin=plugin;this.resize=new ResizeObserver(()=>this.handleResize());this.resize.observe(parent);}
 static async create(id:string,_options:unknown){
  const parent=document.getElementById(id)! as HTMLDivElement;parent.classList.add('msp-plugin');const canvas=document.createElement('canvas');canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block';parent.append(canvas);
  const plugin=new PluginContext(DefaultPluginSpec());await plugin.init();if(plugin.representation.structure.registry.get('interactions').name!=='interactions')plugin.representation.structure.registry.add(InteractionsRepresentationProvider);if(!await plugin.initViewerAsync(canvas,parent))throw new Error('WebGL could not initialize. Check the graphics driver.');
  plugin.canvas3d!.setProps({transparentBackground:true,renderer:{backgroundColor:Color(0x0a1019)},camera:{helper:{axes:{name:'off',params:{}}}}} as any);
  const viewer=new LocalViewer(plugin,parent);LocalViewer.instances.push(viewer);return viewer;
 }
 async prepareInteractions(structure:any){const props=ParamDefinition.getDefaultValues(InteractionsProvider.getParams(structure));const ionic:any=(InteractionsProvider.getParams(structure).providers as any).params.ionic;props.providers.ionic={name:'on',params:ParamDefinition.getDefaultValues(ionic.map('on').params)} as any;await this.plugin.runTask(Task.create('Classifying typed interactions',ctx=>InteractionsProvider.attach({runtime:ctx,assetManager:this.plugin.managers.asset},structure,props,true)));return props;}
 structureInteractivity(options:any){applyStructureInteractivity(this.plugin,options);}
 setVisibility(ref:string,hidden:boolean){setSubtreeVisibility(this.plugin.state.data,ref,hidden);}
 async updateRepresentation(component:any,representation:any,options:any){
  const params=createStructureRepresentationParams(this.plugin,component.cell.obj.data,options);
  await this.plugin.build().to(representation).update(params).commit({revertOnError:true});
 }
 async updateVolume(roots:string[],settings:{iso:number;isoType:'relative'|'absolute';color:number;alpha:number;hidden:boolean}){
  const state=this.plugin.state.data,owned=(ref:string)=>{let current=ref;while(current&&state.cells.has(current)){if(roots.includes(current))return true;const parent=state.cells.get(current)!.transform.parent;if(parent===current)break;current=parent;}return false;};
  const update=this.plugin.build();let changed=false;
  for(const [ref,cell]of state.cells){if(cell.transform.transformer.id!==StateTransforms.Representation.VolumeRepresentation3D.id||!owned(ref))continue;const volume=state.cells.get(cell.transform.parent)?.obj?.data as any;if(!volume?.grid)throw new Error('Map volume is unavailable.');update.to(ref).update(createVolumeRepresentationParams(this.plugin,volume,{type:'isosurface',typeParams:{alpha:settings.alpha,isoValue:Volume.adjustedIsoValue(volume,settings.iso,settings.isoType)},color:'uniform',colorParams:{value:Color(settings.color)}}));changed=true;}
  if(changed)await update.commit({revertOnError:true});for(const ref of roots)this.setVisibility(ref,settings.hidden);
 }
 async loadVolumeFromUrl(source:any,values:any,options:any){
  const before=new Set(this.plugin.state.data.cells.keys());
  try{
   if(source.format==='cube'){
    // A density map must not add a second coordinate model. The general Cube
    // provider also builds a molecular trajectory, which rejects atom-free maps.
    let represented=false;let parseFailure:unknown;
    await this.plugin.dataTransaction(async()=>{
     try{
     const data=await this.plugin.builders.data.download(source,{state:{isGhost:true}});
     const header=(data.data as string).split(/\r?\n/,6);
     const atomFields=header[2]?.trim().split(/\s+/).map(Number)??[];
     if(atomFields[0]<0||(atomFields[4]!==undefined&&atomFields[4]!==1))throw new Error('Use a single-dataset density Cube file with a nonnegative atom count.');
     const dimensions=header.slice(3,6).map(line=>Number(line.trim().split(/\s+/)[0]));
     if(dimensions.length!==3||dimensions.some(n=>!Number.isInteger(n)||n<=0))throw new Error('Cube maps require positive grid counts and Bohr coordinates. Convert an Angstrom-grid Cube file before opening it.');
     if(dimensions.reduce((a,b)=>a*b,1)>32000000)throw new Error('Cube map exceeds 32 million grid values.');
     const format=this.plugin.build().to(data).apply(StateTransforms.Data.ParseCube,{}, {state:{isGhost:true}});
     const volume=await format.apply(StateTransforms.Volume.VolumeFromCube,{entryId:options?.entryId??''}).apply(StateTransforms.Volume.CustomVolumeProperties).commit({revertOnError:true});
     if(!volume.isOk||!volume.data)throw new Error('The Cube file did not produce a volume.');
     const update=this.plugin.build();
     for(const iso of values)update.to(volume).apply(StateTransforms.Representation.VolumeRepresentation3D,createVolumeRepresentationParams(this.plugin,volume.data,{type:'isosurface',typeParams:{alpha:iso.alpha??1,isoValue:Volume.adjustedIsoValue(volume.data,iso.value,iso.type)},color:'uniform',colorParams:{value:iso.color}}));
     await update.commit({revertOnError:true});represented=true;
     }catch(error){parseFailure=error;throw error;}
    });
    if(parseFailure)throw parseFailure;
    if(!represented)throw new Error('The Cube file could not be displayed. Check its header, grid and values.');
   }else await loadVolumeFromUrl(this.plugin,source,values,options);
   const volumes=[...this.plugin.state.data.cells].filter(([ref,cell])=>!before.has(ref)&&cell.obj?.type.name==='Volume').map(([,cell])=>(cell.obj as any).data.grid);
   if(!volumes.length||volumes.some(grid=>!grid.cells.data.length||!grid.cells.data.every((value:number)=>Number.isFinite(value))))throw new Error('The file did not produce a finite density grid. Check the map format and values.');
  }catch(error){
   const update=this.plugin.build();let changed=false;
   for(const [ref,cell]of this.plugin.state.data.cells)if(!before.has(ref)&&before.has(cell.transform.parent)){update.delete(ref);changed=true;}
   if(changed)await update.commit();throw error;
  }
 }
 handleResize(){this.plugin.canvas3d?.requestResize();}
 dispose(){this.resize.disconnect();this.plugin.dispose();}
}
(window as any).molstar={Viewer:LocalViewer,lib:{structure:{StructureElement},math:{LinearAlgebra:{Vec3,Mat4}}}};
