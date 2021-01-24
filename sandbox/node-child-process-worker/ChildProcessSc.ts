import { noopChannelDataProcessor, RpcServiceAdapter } from "../ServiceCommunicator";

import * as ChildProcess from "child_process";
import { EventEmitter } from "events";

type MessagePortListener = ((this: MessagePort, ev: MessageEvent<any>) => any) | null;

class ParentProcessChannelMessagePort implements MessagePort {
  private events: EventEmitter = new EventEmitter();
  private defaultMessageListener: MessagePortListener = null;

  constructor() {
    if (!process.send) {
      throw new Error('channel to parent process on open, "process.send" undefined');
    }
    process.on("message", this.onParentMessage);
  }
  destroy() {
    process.off("message", this.onParentMessage);
  }
  get onmessage(): MessagePortListener {
    return this.defaultMessageListener;
  }
  set onmessage(listener: MessagePortListener) {
    if (listener) {
      this.addEventListener("message", listener);
    } else {
      this.removeEventListener("message", this.defaultMessageListener as any);
      this.defaultMessageListener = null;
    }
  }
  get onmessageerror(): MessagePortListener {
    return null;
  }
  set onmessageerror(listener: MessagePortListener) {}
  close(): void {
    this.destroy();
  }
  postMessage(message: any, transfer: Transferable[]): void;
  postMessage(message: any, options?: PostMessageOptions): void;
  postMessage(message: any, _options?: any) {
    process.send!(message);
  }
  start(): void {}
  addEventListener<K extends "message" | "messageerror">(
    type: K,
    listener: (this: MessagePort, ev: MessagePortEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(type: any, listener: any, options?: any) {
    this.events.addListener(type, listener);
  }
  removeEventListener<K extends "message" | "messageerror">(
    type: K,
    listener: (this: MessagePort, ev: MessagePortEventMap[K]) => any,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(type: any, listener: any, options?: any) {
    this.events.removeListener(type, listener);
  }
  dispatchEvent(event: Event): boolean {
    throw new Error("Method not implemented.");
  }
  private onParentMessage = (message: ChildProcess.Serializable) => {
    this.events.emit("message", { type: "message", data: message });
  };
}

export function startChildProcessWorkerServiceAdapter<P>(impl: P) {
  const port = new ParentProcessChannelMessagePort();

  return new RpcServiceAdapter(port, impl, noopChannelDataProcessor);
}
