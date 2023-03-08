export interface EyeMessage {
  id: string;
  type: "request" | "response" | "error";
  resource: string;
  payload: any;
}

export interface EyeRequest extends EyeMessage {
  type: "request";
}
export interface EyeResponse extends EyeMessage {
  type: "response";
}

export interface EyeError extends EyeMessage {
  type: "error";
}

export interface RequestPromise {
  id: string;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

export interface EyeframeStatus {
  href?: string;
  ready: boolean;
}

export type Handler = (payload: any) => Promise<any>;

export interface Callbacks {
  [resource: string]: Handler;
}
