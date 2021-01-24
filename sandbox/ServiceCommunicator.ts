// tslint:disable:no-console

import { isObservable, Observable, Subject, Subscription } from "rxjs";
import { multicast, refCount } from "rxjs/operators";

type PropertyResolveType<P> = P extends (...args: any) => any ? ReturnType<P> : P;
type PropertyCallParams<P> = P extends (...args: any) => any ? Parameters<P> : [];

type DepromisifyType<T> = T extends PromiseLike<infer K> ? K : T;

type MakeReturnType<T> =
    T extends Observable<any> ? T :
    T extends Promise<any> ? T :
    Promise<DepromisifyType<T>>

export type PromisifyMethods<P> = {
    [K in keyof P]: (
        ...args: PropertyCallParams<P[K]>
    ) => MakeReturnType<PropertyResolveType<P[K]>>;
};

// tslint:disable:no-shadowed-variable
type AddOptionalParam<T, E> = T extends []
    ? [E?]
    : T extends [infer T0]
    ? [T0, E?]
    : T extends [infer T0, infer T1]
    ? [T0, T1, E?]
    : T extends [infer T0, infer T1, infer T2]
    ? [T0, T1, T2, E?]
    : never;
// tslint:enable:no-shadowed-variable

type AddTransferable<T> = AddOptionalParam<T, Transferable[] | undefined>;

interface TransferableError {
    message: string;
    stack?: string;
}

function extractTransferableError(error: any): TransferableError {
    if (error instanceof Error) {
        return {
            message: error.message,
            stack: error.stack
        }
    } else {
        return {
            message: String(error)
        }
    }
}

function rebuildRuntimeError(error: TransferableError | Error): Error {
    if (error instanceof Error) {
        return error;
    }
    const newError = new Error(`(in worker) ${error.message}`);
    if (error.stack) {
        newError.stack = error.stack;
    }
    return newError;
}

/**
 * Process sending/receiving data.
 *
 * May implement channel runtime specific logic like.
 *
 * Serializing special objects, automatically extracting transferable objects etc.
 */
interface WireFormatProcessor {
    toWireFormat(args: unknown[]): [unknown[], Transferable[]];
    fromWireFormat(error: TransferableError | unknown, ret: unknown): [TransferableError | Error | undefined, unknown];
}

const EMPTY_ARRAY: Transferable[] = [];
export const noopChannelDataProcessor: WireFormatProcessor = {
    toWireFormat(args: unknown[]) {
        return [args, EMPTY_ARRAY];
    },
    fromWireFormat(error: TransferableError | Error | undefined, ret: unknown) {
        return [error && rebuildRuntimeError(error), ret];
    }
}

export function getTransferList(args: any[]): Transferable[] {
    const ImageBitmapConstructor = self.ImageBitmap || undefined;
    if (args.length === 0) {
        return [];
    }
    const candidate = args[args.length - 1];
    if (Array.isArray(candidate)) {
        if (candidate.length === 0) {
            return [];
        }
        for (const item of candidate) {
            if (
                !(
                    item instanceof ArrayBuffer ||
                    item instanceof MessagePort ||
                    (ImageBitmapConstructor !== undefined && item instanceof ImageBitmapConstructor)
                )
            ) {
                return [];
            }
            args.pop();
            return candidate;
        }
    }
    let r: any[] = [];
    for (const arg of args) {
        if (arg === null || arg === undefined) {
            continue;
        }
        if (arg instanceof MessagePort) {
            r.push(arg);
        }
        if (arg.$transferList) {
            const r = arg.$transferList;
            delete arg.$transferList;
            return r;
        }
    }
    return r;
}

/**
 * Channel Data processor that extracts transferable objects.
 *
 */
export const basicWebWorkerChannelDataProcessor: WireFormatProcessor = {
    toWireFormat(args: unknown[]) {
        const transferList = getTransferList(args);
        return [args, transferList];
    },
    fromWireFormat(error: TransferableError | undefined, ret: unknown) {
        return [error && rebuildRuntimeError(error), ret];
    }

}

enum ChannelMessageType {
    CALL,     // C->S, create request channel
    CLOSE,    // C->S, close request with observable
    NEXT,     // next value (observable)
    ERROR,    // *error - both for (observable and promise)
    COMPLETE, // complete with no value (observables)
    RESOLVE,  // S->C, kind of next & complete iow. resolve (promise)
}

interface CallMessage {
    type: ChannelMessageType.CALL,
    channelId: number,
    method: string,
    args: unknown[],
    channelArgs?: number[]
}

interface CloseMessage {
    type: ChannelMessageType.CLOSE;
    channelId: number;
}

interface CompleteMessage {
    type: ChannelMessageType.COMPLETE;
    channelId: number;
}

interface ResolveMessage {
    type: ChannelMessageType.RESOLVE;
    channelId: number;
    data: unknown;
}

interface NextMessage {
    type: ChannelMessageType.NEXT;
    channelId: number;
    data: unknown;
}

interface ErrorMessage {
    type: ChannelMessageType.ERROR;
    channelId: number;
    data: TransferableError;
}

type ChannelMessage = CallMessage | NextMessage | CompleteMessage | ResolveMessage | ErrorMessage | CloseMessage;

function postChannelMessage(port: MessagePort, message: ChannelMessage, transferList?: Transferable[]) {
    port.postMessage(message, transferList || [])
}

function isChannelMessage(input: unknown): input is ChannelMessage {
    const message = input as Partial<ChannelMessage>;
    return typeof message.type === 'number' && message.type in ChannelMessageType &&
        typeof message.channelId === 'number';
}
/**
 * Communicate with service `P` using `MessagePort`.
 *
 * Supports calling `P` methods with proper typing.
 *
 *  - call-and-wait-for-result using `call`
 *
 * Typings features:
 * * allows only calling methods that name is `keyof P`
 * * argument types and result type matches `P[K]`
 * * all results are promisified
 * * there is one optional parameter - `transferList` added to each method
 *
 * Example
 * ```
 * interface Foo {
 *     foo(int: bar): void;
 *     x(b: ArrayBuffer): int;
 * }
 * const c = new ServiceCommunicator<Foo>(port);
 * await c.call('foo', 123);
 * const x.number = await c.call('x', b, [b])
 * ```
 *
 * See also [[createProxyServiceCommunicator]] to create automagic proxy that conform to
 * `promisified` version of interface.
 *
 * Other side of `MessageChannel` must run [[ServiceImplementationAdapter]].
 *
 * @param P - protocol interface
 */
export class RpcCommunicator<P> {
    private callChannels: Map<number, Subject<any>> = new Map();
    private outSubscriptions: Map<number, Subscription> = new Map();
    private nextCallChannelId: number = 0;
    private nextOutChannelId: number = 0;
    private port: MessagePort;
    private channelDataProcessor: WireFormatProcessor;

    constructor(port: MessagePort, channelDataProcessor?: WireFormatProcessor) {
        this.port = port;
        this.port.onmessage = this.onMessage;
        this.channelDataProcessor = channelDataProcessor || noopChannelDataProcessor;
        // this.port.addEventListener("message", this.onMessage);
    }

    destroy() {
        this.port.onmessage = null;
        for (const subscription of this.outSubscriptions.values()) {
            subscription.unsubscribe();
        }
        this.outSubscriptions.clear();
        for (const subject of this.callChannels.values()) {
            if (!subject.closed) {
                subject.error(new Error("RpcCommunicator channel destroyed"));
            }
        }
        this.callChannels.clear();
        //this.port.removeEventListener("message", this.onMessage);
    }

    onMessage = (event: MessageEvent) => {
        console.log("RpcCommunicator#onMessage", event);
        const message = event.data;
        if (isChannelMessage(message)) {
            this.handleChannelMessage(message);
        } else {
            console.log(`MessagePortProtocolAdapter unknown message type: ${message.type}`);
        }
    };

    call<K extends keyof P, R = DepromisifyType<PropertyResolveType<P[K]>>>(
        type: K,
        ...args: AddTransferable<PropertyCallParams<P[K]>>
    ): Promise<R> & Observable<R> {
        const [args1, channels] = this.extractOutChannelsForArgs(args);
        const [massagesArgs, transferList] = this.channelDataProcessor.toWireFormat(args1);
        const channelId = this.nextCallChannelId++;
        // TODO, maybe capture call stack using stuff like AsyncResource
        //  https://nodejs.org/api/async_hooks.html
        postChannelMessage(this.port,
            {
                type: ChannelMessageType.CALL,
                method: type as string,
                channelId,
                args: massagesArgs,
                channelArgs: channels
            },
            transferList
        );
        const [s, o] = createClosableSubject<R>(() => {
            postChannelMessage(this.port, {
                type: ChannelMessageType.CLOSE,
                channelId
            });
            this.callChannels.delete(channelId);
        });
        this.callChannels.set(channelId, s);
        const op: Observable<R> & Promise<R> = o as any;
        let p: Promise<R>;
        op.then = async (c1: any, c2: any) => {
            if (!p) {
                p = o.toPromise();
            }
            return p.then(c1, c2);
        }
        op.catch = async (c: any) => {
            if (!p) {
                p = o.toPromise();
            }
            return p.catch(c);
        }
        return op;
    }

    private extractOutChannelsForArgs(args: any[]): [any[], number[] | undefined] {
        let channelIds: number[] | undefined = undefined;
        for (let i = 0; i < args.length; i++) {
            if (isObservable(args[i])) {
                const observable: Observable<any> = args[i];
                args[i] = undefined;
                if (!channelIds) {
                    channelIds = Array(args.length);
                }
                channelIds[i] = this.createOutChannel(observable);
            }
            // TODO: Is this feasible to forward promise as channel to worker ?
            // that would be awesome kind-a, or very stupid :)
            // what about stream-like stuff in NODE ?
            // what about message channel, ouch it's one step to far i guess
            // if (isPromiseLike(args[i])) {
            //     args[i] = undefined;
            // if (!channelIds) {
            //     channelIds = Array(args.length);
            // }
            // channelIds[i] = this.createOutChannel(from(args[i] as Promise<any>));
            // }
        }
        return [args, channelIds]
    }

    private createOutChannel(observable: Observable<unknown>) {
        const channelId = this.nextOutChannelId++

        const subscription = observable.subscribe(
            next => postChannelMessage(this.port, {
                channelId,
                type: ChannelMessageType.NEXT,
                data: next
            }),
            error => {
                postChannelMessage(this.port,
                    {
                        type: ChannelMessageType.ERROR,
                        channelId,
                        data: extractTransferableError(error)
                    }
                );
                subscription.unsubscribe();
                this.outSubscriptions.delete(channelId);
            }, () => {
                postChannelMessage(this.port,
                    {
                        channelId,
                        type: ChannelMessageType.COMPLETE
                    }
                );
                subscription.unsubscribe();
                this.outSubscriptions.delete(channelId);
            });
        this.outSubscriptions.set(channelId, subscription);

        return channelId;
    }

    private handleChannelMessage(message: ChannelMessage) {
        const channelId = message.channelId;
        if (message.type === ChannelMessageType.CLOSE) {
            // S closed one of our "arg out" channels
            const o = this.outSubscriptions.get(channelId);
            if (o) {
                o?.unsubscribe();
            }
            this.outSubscriptions.delete(channelId);
            return;
        }

        // all other calls are to "call channels"
        const subscriber = this.callChannels.get(channelId);
        if (!subscriber) {
            return;
        }

        if (message.type === ChannelMessageType.RESOLVE) {
            // S resolved promise
            const [_, decodedData] = this.channelDataProcessor.fromWireFormat(undefined, message.data);
            subscriber.next(decodedData)
            subscriber.complete();
            this.callChannels.delete(channelId);
        } else if (message.type === ChannelMessageType.NEXT) {
            // S send observable update
            const [_, decodedData] = this.channelDataProcessor.fromWireFormat(undefined, message.data);
            subscriber.next(decodedData)
        } else if (message.type === ChannelMessageType.ERROR) {
            // S send observable or promise error
            this.callChannels.delete(channelId);
            const [decodedError] = this.channelDataProcessor.fromWireFormat(message.data, undefined);
            subscriber.error(decodedError);
        } else if (message.type === ChannelMessageType.COMPLETE) {
            // S completed channel
            this.callChannels.delete(channelId);
            subscriber.complete();
        }
    }
}

export function createProxyServiceCommunicator<P>(
    target: RpcCommunicator<P> | MessagePort
): PromisifyMethods<P> {
    const dummy: any = {};
    if (!(target instanceof RpcCommunicator)) {
        target = new RpcCommunicator(target);
    }
    return new Proxy(dummy, {
        get(_: any, key: string | symbol) {
            // safety guard, as Promise attempts to check if `then` is callable
            // and thus our proxy is treated as Promise
            if (key === "then") {
                return undefined;
            }
            if (key in dummy) {
                return dummy[key];
            }
            const target2 = target as RpcCommunicator<P>;
            const call = target2.call as any;
            // tslint:disable-next-line:only-arrow-functions
            const fun = (dummy[key] = function (...args: any[]) {
                return call.apply(target2, [key as keyof P, ...args]);
            });
            return fun;
        }
    });
}

export class RpcServiceAdapter<P> {
    private argInChannels: Map<number, [Subject<any>, Observable<any>]> = new Map();
    private callOutChannels: Map<number, Subscription> = new Map();

    constructor(readonly port: MessagePort, readonly protocolImpl: P, readonly wireFormatProcessor: WireFormatProcessor) {
        // Why the hell addEventListener doesn't work here !?
        // port.addEventListener("message", this.onMessage);
        port.onmessage = this.onMessage;
    }

    destroy() {
        // port.addEventListener("message", this.onMessage);
        this.port.onmessage = null;

        for (const [subject, _] of this.argInChannels.values()) {
            if (!subject.closed) {
                subject.error(new Error("RpcServiceAdaptor destroyed"));
            }
        }
        this.argInChannels.clear();

        for (const subscription of this.callOutChannels.values()) {
            subscription.unsubscribe();
        }
        this.callOutChannels.clear();
    }

    private onMessage = (event: MessageEvent) => {
        console.log("RpcServiceAdapter#onMessage", event);
        const message = event.data;
        if (isChannelMessage(message)) {
            this.handleChannelMessage(message);
        } else {

        }
    };

    private handleChannelMessage(message: ChannelMessage) {
        if (message.type === ChannelMessageType.CALL) {
            this.handleCall(message.channelId, message.method as keyof P, message.args, message.channelArgs);
            return;
        }

        const channelId = message.channelId;
        if (message.type === ChannelMessageType.CLOSE) {
            // C closed one of our "call out" channels
            const x = this.callOutChannels.get(channelId);
            if (x) {
                x.unsubscribe();
                this.callOutChannels.delete(channelId);
            }
            return;
        }

        // all other actions are "arg in" channels
        const entry = this.argInChannels.get(channelId);
        if (!entry) {
            return;
        }
        const [subject, _] = entry;
        if (subject.closed) {
            return;
        }

        if (message.type === ChannelMessageType.NEXT) {
            const [_, decodedData] = this.wireFormatProcessor.fromWireFormat(undefined, message.data);
            subject.next(decodedData)
        } else if (message.type === ChannelMessageType.ERROR) {
            this.argInChannels.delete(channelId);
            const [decodedError] = this.wireFormatProcessor.fromWireFormat(message.data, undefined);
            subject.error(decodedError);
        } else if (message.type === ChannelMessageType.COMPLETE) {
            this.argInChannels.delete(channelId);
            subject.complete();
        }
    }

    private handleCall(channelId: any, method: keyof P, args: any[], channelArgs: number[] | undefined) {
        const prop = this.protocolImpl[method];

        if (channelArgs) {
            for (let i = 0; i < channelArgs.length; i++) {
                if (channelArgs[i] === undefined) {
                    continue;
                }
                const observable = this.getArgInObservable(channelArgs[i]);
                args[i] = observable;
            }
        }
        type R = P[typeof method] extends (...args: any) => any
            ? ReturnType<P[typeof method]>
            : P[typeof method];

        const result: R =
            typeof prop === "function" ? (prop.apply(this.protocolImpl, args) as R) : (prop as R);

        if (isObservable(result)) {
            const subscription = result.subscribe(next => {
                // TODO: encode next
                postChannelMessage(this.port,
                    {
                        type: ChannelMessageType.NEXT,
                        channelId,
                        data: next
                    }
                );
            }, error => {
                // TODO: encode error
                console.error("RpcServiceAdapter: forwarding error", error);
                postChannelMessage(this.port,
                    {
                        type: ChannelMessageType.ERROR,
                        channelId,
                        data: extractTransferableError(error)
                    }
                );
                this.callOutChannels.delete(channelId);
                subscription.unsubscribe();
            }, () => {
                postChannelMessage(this.port,
                    {
                        type: ChannelMessageType.COMPLETE,
                        channelId
                    }
                );
                this.callOutChannels.delete(channelId);
                subscription.unsubscribe();
            })
            this.callOutChannels.set(channelId, subscription);
        } else {
            Promise.resolve(result)
                .then(resolvedResult => {
                    postChannelMessage(this.port,
                        {
                            type: ChannelMessageType.RESOLVE,
                            channelId,
                            data: resolvedResult
                        }
                    );
                })
                .catch((error: Error) => {
                    console.error("RpcServiceAdapter: forwarding error", error);
                    postChannelMessage(this.port,
                        {
                            type: ChannelMessageType.ERROR,
                            channelId,
                            data: extractTransferableError(error)
                        }
                    );
                });
        }
    }

    private getArgInObservable(channelId: number) {
        let entry = this.argInChannels.get(channelId);
        if (entry) {
            return entry[0];
        }
        entry = createClosableSubject(() => {
            this.port.postMessage(
                {
                    action: ChannelMessageType.CLOSE,
                    channelId,
                }
            )
            this.argInChannels.delete(channelId);
        })
        this.argInChannels.set(channelId, entry);
        return entry[0];
    }
}

//
// that's kind of magic
// see https://rxjs.dev/guide/subject#reference-counting
//
function createClosableSubject<R>(onclose: () => void): [Subject<R>, Observable<R>] {
    const sink = new Subject<R>();
    const o: Observable<R> = new Observable<R>((subscriber => {
        const s = sink.subscribe(subscriber);
        return () => {
            s.unsubscribe();
            onclose();
        }
    }));

    const temp: Subject<R> = new Subject()
    return [sink, o.pipe(multicast(temp), refCount())];
}

//
//
//

async function main() {

}

main().catch(error => {
    console.error("??", error);
    process.abort();
});
