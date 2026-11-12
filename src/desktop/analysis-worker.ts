import { parentPort, workerData } from 'node:worker_threads';
import { importStructure, runGeometry, parseProject, alignStructures } from '../engine';
try {
  const value = workerData.operation === 'alignment'
    ? alignStructures(workerData.reference,workerData.mobile,workerData.request)
    : workerData.operation === 'project'
    ? parseProject(workerData.text)
    : workerData.operation === 'import'
    ? importStructure({schemaVersion:'1.0.0',jobId:'import_1',format:workerData.format,text:workerData.text,metadata:workerData.metadata})
    : runGeometry(workerData.structure, workerData.request);
  parentPort!.postMessage({ ok: true, value });
} catch (error: any) {
  parentPort!.postMessage({ ok: false, error: {
    code: error?.code ?? 'COMPUTATION_FAILED', message: error?.message ?? 'The worker failed.',
    recovery: error?.recovery ?? 'Review the structure diagnostics and supported input policies.',
  } });
}

