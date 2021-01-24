import * as ChildProcess from "child_process";
import { EventEmitter } from "events";

type MessagePortListener = ((this: MessagePort, ev: MessageEvent<any>) => any) | null;

class ChildProcessChannelMessagePort implements MessagePort {
  private events: EventEmitter = new EventEmitter();
  private defaultMessageListener: MessagePortListener = null;
  private defaultMessageErrorListener: MessagePortListener = null;

  constructor(readonly process: ChildProcess.ChildProcess) {
    process.on("message", this.onProcessMessage);
  }

  destroy() {
    process.off("message", this.onProcessMessage);
  }
  get onmessage(): MessagePortListener {
    return this.defaultMessageListener;
  }
  set onmessage(listener: MessagePortListener) {
    if (listener) {
      this.addEventListener("message", listener);
      this.defaultMessageListener = listener;
    } else {
      this.removeEventListener("message", this.defaultMessageListener as any);
      this.defaultMessageListener = null;
    }
  }
  get onmessageerror(): MessagePortListener {
    return null;
  }
  set onmessageerror(listener: MessagePortListener) {
    if (listener) {
      this.addEventListener("messageerror", listener);
      this.defaultMessageErrorListener = listener;
    } else {
      this.removeEventListener("messageerror", this.defaultMessageErrorListener as any);
      this.defaultMessageErrorListener = null;
    }
  }
  close(): void {
    this.destroy();
  }
  postMessage(message: any, transfer: Transferable[]): void;
  postMessage(message: any, options?: PostMessageOptions): void;
  postMessage(message: any, _options?: any) {
    this.process.send(message);
  }
  start(): void {
    throw new Error("Method not implemented.");
  }
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
    // really don't know what is reason for this
    this.events.emit(event.type, event);
    return true;
  }
  private onProcessMessage = (message: ChildProcess.Serializable) => {
    this.events.emit("message", { type: "message", data: message });
  };
}

export class ChildProcessWorker {
  private process: ChildProcess.ChildProcess;
  public port: MessagePort;
  constructor(modulePath: string) {
    this.process = ChildProcess.fork(modulePath, {
      serialization: "json",
    });
    this.port = new ChildProcessChannelMessagePort(this.process);
  }

  destroy() {
    this.process.kill();
  }

  stop() {
    const p = new Promise((resolve) => {
      this.process.on("exit", resolve);
    });
    this.process.kill();
    return p;
  }
}
