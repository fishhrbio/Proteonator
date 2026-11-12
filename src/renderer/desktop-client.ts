import {AppErrorSchema,type DesktopReply} from '../contracts/index.js';
/** Construct the Error on the receiving side, after the data crosses isolation. */
export function unwrapReply<T>(reply:DesktopReply<T>):T {
  if(reply.ok) return reply.value;
  const error=AppErrorSchema.parse(reply.error);
  throw Object.assign(new Error(error.message),error);
}
