const {app,BrowserWindow}=require('electron');
app.whenReady().then(()=>{const w=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});w.loadURL('data:text/html,<html lang="en"><title>Native graphics check</title><body>Native graphics check</body></html>');});
app.on('window-all-closed',()=>app.quit());
