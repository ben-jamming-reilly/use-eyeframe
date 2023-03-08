import { useEffect, useRef, useState } from "react";
import {
  EyeMessage,
  EyeError,
  EyeRequest,
  EyeResponse,
  RequestPromise,
  EyeframeStatus,
  Callbacks,
} from "./types";

let currRequestId = 0;

function eyeRequest(resource: string, payload: any): EyeRequest {
  return {
    id: `hook-${currRequestId++}`,
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

export default function useEyeframe(src: string, cbs: Callbacks = {}) {
  const [status, setStatus] = useState<EyeframeStatus>({
    ready: false,
  });

  const ref = useRef<HTMLIFrameElement>(null);
  const channelRef = useRef<MessageChannel>();
  const requestPromises = useRef(new Map<string, RequestPromise>());

  const onMessage = async (event: MessageEvent) => {
    const message = event.data as EyeMessage;

    if (message.type === "response" && message.resource === "init") {
      // Initialize client
      return setStatus(message.payload);
    }

    if (!status.ready) return;

    if (message.type === "response") {
      // Handle the response, fulfill promise
      const promise = requestPromises.current.get(message.id);
      if (promise) promise.resolve(message.payload);
    } else if (message.type === "error") {
      // Handle the error, reject the promise
      const promise = requestPromises.current.get(message.id);
      if (promise) promise.reject(message.payload);
    } else if (message.type === "request") {
      //
      const iframe = channelRef.current!;
      for (const [resource, callback] of Object.entries(cbs)) {
        if (resource === message.resource) {
          try {
            const payload = await callback(message.payload);
            iframe.port1.postMessage(eyeResponse(message, payload));
          } catch (err) {
            iframe.port1.postMessage(eyeError(message, err));
          }
        }
      }
    }
  };

  // Iframe onload
  const onIframeLoad = () => {
    setStatus((prev) => ({ ...prev, ready: false }));
    channelRef.current = new MessageChannel();
    channelRef.current.port1.onmessage = onMessage;
    ref.current?.contentWindow?.postMessage("init", src, [
      channelRef.current.port2,
    ]);
  };

  useEffect(() => {
    ref.current?.addEventListener("load", onIframeLoad);
    return () => {
      ref.current?.removeEventListener("load", onIframeLoad);
    };
  }, [ref.current]);

  const eyeframe = (resource: string, payload: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const request = eyeRequest(resource, payload);
      channelRef.current?.port1.postMessage(request);

      requestPromises.current.set(request.id, {
        id: request.id,
        resolve: resolve,
        reject: reject,
      });
    });
  };

  return { eyeframe, status, ref, src };
}
