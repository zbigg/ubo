declare type PropertyResolveType<P> = P extends (...args: any) => any ? ReturnType<P> : P;
declare type PropertyCallParams<P> = P extends (...args: any) => any ? Parameters<P> : [];
declare type DepromisifyType<T> = T extends PromiseLike<infer K> ? K : T;
export declare type PromisifyMethods<P> = {
    [K in keyof P]: (...args: PropertyCallParams<P[K]>) => Promise<DepromisifyType<PropertyResolveType<P[K]>>>;
};
declare type AddOptionalParam<T, E> = T extends [] ? [E?] : T extends [infer T0] ? [T0, E?] : T extends [infer T0, infer T1] ? [T0, T1, E?] : T extends [infer T0, infer T1, infer T2] ? [T0, T1, T2, E?] : never;
declare type AddTransferable<T> = AddOptionalParam<T, Transferable[] | undefined>;
interface TransferableError {
    message: string;
    stack?: string;
}
export declare function getTransferList(args: any[]): Transferable[];
/**
 * Communicate with service `P` using `MessagePort`.
 *
 * Supports calling `P` methods with proper typing.
 *
 *  - oneway calls using `callOneWay` - caller desn't wait for
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
export declare class RpcCommunicator<P> {
    private calls;
    private nextCallId;
    private port;
    constructor(port: MessagePort);
    destroy(): void;
    onMessage: (event: MessageEvent) => void;
    callOneWay<K extends keyof P>(type: K, ...args: AddTransferable<PropertyCallParams<P[K]>>): void;
    call<K extends keyof P, R = DepromisifyType<PropertyResolveType<P[K]>>>(type: K, ...args: AddTransferable<PropertyCallParams<P[K]>>): Promise<R>;
    handleCallResponse(callId: any, _: keyof P, error: TransferableError, result: any): void;
}
export declare function createProxyServiceCommunicator<P>(target: RpcCommunicator<P> | MessagePort): PromisifyMethods<P>;
export declare class RpcServiceAdapter<P> {
    readonly port: MessagePort;
    readonly protocolImpl: P;
    constructor(port: MessagePort, protocolImpl: P);
    destroy(): void;
    onMessage: (event: MessageEvent) => void;
    handleMessage(message: keyof P, args: any[]): void;
    handleCall(callId: any, message: keyof P, args: any[]): void;
}
export {};
