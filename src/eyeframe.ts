import {
  RequestPromise,
  EyeMessage,
  Handler,
  EyeRequest,
  EyeResponse,
  EyeError,
} from "./types";

let currRequestId = 0;

function eyeRequest(resource: string, payload: any): EyeRequest {
  return {
    id: `eyeframe-${currRequestId++}`,
    type: "request",
    resource: resource,
    payload: payload,
  };
}

function eyeResponse(request: EyeMessage, payload: any): EyeResponse {
  return {
    id: request.id,
    type: "response",
    resource: request.resource,
    payload: payload,
  };
}

function eyeError(request: EyeMessage, err: any): EyeError {
  return {
    id: request.id,
    type: "error",
    resource: request.resource,
    payload: err,
  };
}

export default function eyeframe(allowedOrigins: string[]) {
  const client = new Client();

  window.addEventListener("message", (event: MessageEvent) => {
    if (!allowedOrigins.includes(event.origin)) return;
    if (event.data === "init") return client.init(event.ports[0]);

    // ensure message is a response
    const message = event.data as EyeMessage;
    client.processMessage(message);
  });

  return client;
}

export class Client {
  private handlers: Record<string, Handler>;
  private port: MessagePort | undefined;
  private requestPromises: Map<string, RequestPromise>;

  constructor() {
    this.handlers = {};
    this.requestPromises = new Map();
  }

  init(port: MessagePort) {
    // Initializes the client for communication
    this.port = port;
    const response: EyeResponse = {
      id: "",
      type: "response",
      payload: {
        ready: true,
        href: location.href,
      },
      resource: "init",
    };
    this.port.postMessage(response);
  }

  on(resource: string, handler: Handler) {
    this.handlers[resource] = handler;
  }

  request(resource: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.port) return reject("No port object");

      const request = eyeRequest(resource, payload);
      this.port.postMessage(request);

      this.requestPromises.set(request.id, {
        id: request.id,
        resolve: resolve,
        reject: reject,
      });
    });
  }

  async processMessage(message: EyeMessage) {
    switch (message.type) {
      case "request":
        this.processRequest(message as EyeRequest);
        break;
      case "response":
        this.processResponse(message as EyeResponse);
        break;
      case "error":
        this.processError(message as EyeError);
        break;
    }
  }

  private async processRequest(request: EyeRequest) {
    if (!this.port) return;

    for (const [resource, handler] of Object.entries(this.handlers)) {
      if (request.resource === resource) {
        try {
          const payload = await handler(request.payload);
          return this.port.postMessage(eyeResponse(request, payload));
        } catch (err) {
          return this.port.postMessage(eyeError(request, err));
        }
      }
    }
    return this.port.postMessage(eyeError(request, "Resource not found"));
  }

  private processResponse(response: EyeResponse) {
    const promise = this.requestPromises.get(response.id);
    if (promise) promise.resolve(response.payload);
  }

  private processError(error: EyeError) {
    const promise = this.requestPromises.get(error.id);
    if (promise) promise.reject(error.payload);
  }
}
