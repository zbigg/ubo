"use strict";
// tslint:disable:no-console
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RpcServiceAdapter = exports.createProxyServiceCommunicator = exports.RpcCommunicator = exports.getTransferList = void 0;
function getTransferList(args) {
    var e_1, _a, e_2, _b;
    var ImageBitmapConstructor = self.ImageBitmap || undefined;
    if (args.length === 0) {
        return [];
    }
    var candidate = args[args.length - 1];
    if (Array.isArray(candidate)) {
        if (candidate.length === 0) {
            return [];
        }
        try {
            for (var candidate_1 = __values(candidate), candidate_1_1 = candidate_1.next(); !candidate_1_1.done; candidate_1_1 = candidate_1.next()) {
                var item = candidate_1_1.value;
                if (!(item instanceof ArrayBuffer ||
                    item instanceof MessagePort ||
                    (ImageBitmapConstructor !== undefined && item instanceof ImageBitmapConstructor))) {
                    return [];
                }
                args.pop();
                return candidate;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (candidate_1_1 && !candidate_1_1.done && (_a = candidate_1.return)) _a.call(candidate_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    var r = [];
    try {
        for (var args_1 = __values(args), args_1_1 = args_1.next(); !args_1_1.done; args_1_1 = args_1.next()) {
            var arg = args_1_1.value;
            if (arg === null || arg === undefined) {
                continue;
            }
            if (arg instanceof MessagePort) {
                r.push(arg);
            }
            if (arg.$transferList) {
                var r_1 = arg.$transferList;
                delete arg.$transferList;
                return r_1;
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (args_1_1 && !args_1_1.done && (_b = args_1.return)) _b.call(args_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return r;
}
exports.getTransferList = getTransferList;
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
var RpcCommunicator = /** @class */ (function () {
    function RpcCommunicator(port) {
        var _this = this;
        this.calls = new Map();
        this.nextCallId = 0;
        this.onMessage = function (event) {
            var message = event.data;
            if (message.callId !== undefined) {
                _this.handleCallResponse(message.callId, message.type, message.error, message.result);
            }
            else {
                console.log("MessagePortProtocolAdapter unknown message type: " + message.type);
            }
        };
        this.port = port;
        this.port.onmessage = this.onMessage;
        // this.port.addEventListener("message", this.onMessage);
    }
    RpcCommunicator.prototype.destroy = function () {
        this.port.onmessage = null;
        //this.port.removeEventListener("message", this.onMessage);
    };
    RpcCommunicator.prototype.callOneWay = function (type) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var transferList = getTransferList(args);
        this.port.postMessage({
            type: type,
            args: args
        }, transferList);
    };
    RpcCommunicator.prototype.call = function (type) {
        var _this = this;
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var transferList = getTransferList(args);
        var callId = this.nextCallId++;
        this.port.postMessage({
            type: type,
            callId: callId,
            args: args
        }, transferList);
        return new Promise(function (resolve, reject) {
            _this.calls.set(callId, { resolve: resolve, reject: reject });
        });
    };
    RpcCommunicator.prototype.handleCallResponse = function (callId, _, error, result) {
        var callInfo = this.calls.get(callId);
        if (callInfo === undefined) {
            console.log("ServiceCommunicator unexpected callId " + callId);
            return;
        }
        this.calls.delete(callId);
        if (error) {
            var e = new Error("(in worker) " + error.message);
            if (error.stack) {
                e.stack = error.stack;
            }
            callInfo.reject(e);
        }
        else {
            callInfo.resolve(result);
        }
    };
    return RpcCommunicator;
}());
exports.RpcCommunicator = RpcCommunicator;
function createProxyServiceCommunicator(target) {
    var dummy = {};
    if (!(target instanceof RpcCommunicator)) {
        target = new RpcCommunicator(target);
    }
    return new Proxy(dummy, {
        get: function (_, key) {
            // safety guard, as Promise attempts to check if `then` is callable
            // and thus our proxy is treated as Promise
            if (key === "then") {
                return undefined;
            }
            if (key in dummy) {
                return dummy[key];
            }
            var target2 = target;
            var call = target2.call;
            // tslint:disable-next-line:only-arrow-functions
            var fun = (dummy[key] = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                return call.apply(target2, __spread([key], args));
            });
            return fun;
        }
    });
}
exports.createProxyServiceCommunicator = createProxyServiceCommunicator;
var RpcServiceAdapter = /** @class */ (function () {
    function RpcServiceAdapter(port, protocolImpl) {
        var _this = this;
        this.port = port;
        this.protocolImpl = protocolImpl;
        this.onMessage = function (event) {
            var message = event.data;
            if (message.callId !== undefined) {
                _this.handleCall(message.callId, message.type, message.args);
            }
            else {
                _this.handleMessage(message.type, message.args);
            }
        };
        // Why the hell addEventListener doesn't work here !?
        // port.addEventListener("message", this.onMessage);
        port.onmessage = this.onMessage;
    }
    RpcServiceAdapter.prototype.destroy = function () {
        // port.addEventListener("message", this.onMessage);
        this.port.onmessage = null;
    };
    RpcServiceAdapter.prototype.handleMessage = function (message, args) {
        var fun = this.protocolImpl[message];
        if (typeof fun !== "function") {
            throw new Error("!");
        }
        fun.apply(this.protocolImpl, args);
    };
    RpcServiceAdapter.prototype.handleCall = function (callId, message, args) {
        var _this = this;
        var prop = this.protocolImpl[message];
        var result = typeof prop === "function" ? prop.apply(this.protocolImpl, args) : prop;
        Promise.resolve(result)
            .then(function (resolvedResult) {
            var transferList = getTransferList([resolvedResult]);
            _this.port.postMessage({
                type: "$call-response",
                callId: callId,
                result: resolvedResult
            }, transferList);
        })
            .catch(function (error) {
            console.error("ServiceCommunicator: forwarding erorr", error);
            _this.port.postMessage({
                type: "$call-response",
                callId: callId,
                error: {
                    message: error.message,
                    stack: error.stack
                }
            });
        });
    };
    return RpcServiceAdapter;
}());
exports.RpcServiceAdapter = RpcServiceAdapter;
