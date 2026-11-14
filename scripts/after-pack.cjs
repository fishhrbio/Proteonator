const {copyFile,access}=require('node:fs/promises');const path=require('node:path');
exports.default=async context=>{
 if(context.electronPlatformName!=='darwin')return;
 const root=context.packager.projectDir,source=path.join(root,'work/mac-graphics/libvulkan.dylib');await access(source);
 const contents=path.join(context.appOutDir,context.packager.appInfo.productFilename+'.app','Contents');
 await copyFile(source,path.join(contents,'Frameworks/Electron Framework.framework/Versions/A/Libraries/libvulkan.dylib'));
 await copyFile(path.join(root,'work/mac-graphics/inventory.json'),path.join(contents,'Resources/mac-graphics-inventory.json'));
};
