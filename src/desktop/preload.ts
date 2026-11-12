import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge, GeometryRequest, AlignmentRequest, JobEvent } from '../contracts';

async function invoke(channel: string, argument?: unknown): Promise<any> {
  const reply = await ipcRenderer.invoke(channel, argument);
  // Resolve plain data across context isolation. Throwing an Error here loses
  // custom code/recovery fields when Electron copies it into the renderer.
  return reply;
}
const bridge: DesktopBridge = {
  loadExample: id => invoke('proview:example', id),
  importLocal: () => invoke('proview:import'),
  retrieveAccession: accession => invoke('proview:retrieve', accession),
  importComparison: () => invoke('proview:comparison-import'),
  analyze: (request: GeometryRequest) => invoke('proview:analyze', request),
  align: (request: AlignmentRequest) => invoke('proview:align', request),
  openHelp: () => invoke('proview:help'),
  exportAlignment: result => invoke('proview:export-alignment', result),
  openProject: () => invoke('proview:open-project'),
  saveProject: state => invoke('proview:save-project', state),
  exportGeometry: result => invoke('proview:export-geometry', result),
  exportPng: dataUrl => invoke('proview:export-png', dataUrl),
  cancel: jobId => invoke('proview:cancel', jobId),
  onJob: listener => {
    const callback = (_event: unknown, event: JobEvent) => listener(event);
    ipcRenderer.on('proview:job', callback);
    return () => ipcRenderer.removeListener('proview:job', callback);
  },
};
contextBridge.exposeInMainWorld('proview', bridge);
