import { AppErrorSchema, type AppError } from '../contracts/index.js';

export class EngineError extends Error {
  readonly code: AppError['code'];
  readonly recovery: string;
  readonly details?: AppError['details'];
  constructor(error: AppError) {
    const parsed = AppErrorSchema.parse(error);
    super(parsed.message);
    this.name = 'EngineError'; this.code = parsed.code; this.recovery = parsed.recovery;
    if (parsed.details) this.details = parsed.details;
  }
  toJSON(): AppError {
    return AppErrorSchema.parse({code:this.code,message:this.message,recovery:this.recovery,...(this.details ? {details:this.details} : {})});
  }
}
export function invalidInput(message: string, details?: AppError['details']): never {
  throw new EngineError({code:'INVALID_INPUT',message,recovery:'Check the input file and selections; use PDB fixed-column formatting and coordinates in angstroms.',...(details ? {details} : {})});
}
export function toAppError(error: unknown): AppError {
  if(error instanceof EngineError) return error.toJSON();
  return AppErrorSchema.parse({code:'COMPUTATION_FAILED',message:error instanceof Error ? error.message : 'Unexpected computation failure',recovery:'Retry with a smaller supported structure. Retain the input and diagnostics when reporting the failure.'});
}
