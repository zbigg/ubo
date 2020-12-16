import * as mongoose from "mongoose";
import * as _ from "lodash";
import { map as bluebirdMap } from "bluebird";

import { exposeAction, useMiddleware } from "@ubo/core";
import { cliRunDefault } from "@ubo/cli";

//
// https://stackoverflow.com/questions/52800639/cant-understand-excludet-u-in-typescript-correctly
// https://www.typescriptlang.org/docs/handbook/advanced-types.html
//

type FunctionPropertyNames<T> = {
    [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];
type FunctionProperties<T> = Pick<T, FunctionPropertyNames<T>>;

type NonFunctionPropertyNames<T> = {
    [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];
type NonFunctionProperties<T> = Pick<T, NonFunctionPropertyNames<T>>;

type XPropertyNames<T, X> = {
    [K in keyof T]: T[K] extends X ? K : never;
}[keyof T];
type XProperties<T, X> = Pick<T, XPropertyNames<T, X>>;

interface GeoCoordinate {
    latitute: number;
    longitude: number;
}

interface Types {
    ["string"]: string,
    ["number"]: number,
    ["boolean"]: boolean,
    ["Date"]: Date
}

interface Types {
    ["geocoord"]: GeoCoordinate
}

// Types infra
type ApiTypeNames = keyof Types;
type ApiType<K extends keyof Types> = Types[K];

//
// XPropertyNames test against Types
//
type z0 = XPropertyNames<Types, string>;


//
// Constructed literal types attempt
//
type PositionalBase = { name: string };
type PositionalRequired<B extends string> = PositionalBase & { type: { type: B } };
type PositionalOptional<B extends string> = PositionalBase & { type: { type: `${B}?` } };
type PositionalArray<B extends string> = PositionalBase & { type: { type: `${B}...` } };

type Positional<B extends string> = PositionalRequired<B> | PositionalOptional<B> | PositionalArray<B>;

type z1 = Positional<XPropertyNames<Types, string>>;
const x: z1 = { name: "x", type: { type: "string..." } }


//
// extract X from X | undefined into non-union type<X>
//
type MyOptional<T> = T & { isOptional: true };

type WTF<T> = undefined extends T ? T extends (infer X | undefined) ? MyOptional<X> : T : T;
type WTFa<T> = [undefined] extends [T] ? T extends (infer X | undefined) ? MyOptional<X> : T : T;
type WTFb<T> = T extends (infer X | undefined) ? MyOptional<X> : never;

type w3 = WTF<string>;
type w5 = WTF<string | undefined>;

type wa3 = WTFa<string>;
type wa5 = WTFa<string | undefined>;

type wb3 = WTFb<string>;
type wb5 = WTFb<string | undefined>;

// type PositionalSchemaTypeSpecifierInt<T, S extends keyof Types, U extends Types[S] = Types[S]> =
//     T extends MyOptional<U>
//     ? { type: S, optional: true }
//     : T extends U
//     ? { type: S, required: true }
//     : T extends U[]
//     ? { type: S, isArray: true }
//     : never;

type PositionalSchemaTypeSpecifierInt<T, S extends keyof Types, U extends Types[S] = Types[S]> =
    T extends MyOptional<U>
    ? { type: `${S}?` }
    : T extends U
    ? { type: S }
    : T extends U[]
    ? { type: `${S}[]` }
    : never;

type MarkOptional<T> = [undefined] extends [T] ? T extends (infer X | undefined) ? MyOptional<X> : T : T;

type PositionalSchemaTypeSpecifierA<T, K extends keyof Types> =
    K extends any ?
    PositionalSchemaTypeSpecifierInt<MarkOptional<T>, K>
    : never;

type pstsA1 = PositionalSchemaTypeSpecifierA<string, ApiTypeNames>;
type pstsA1o = PositionalSchemaTypeSpecifierA<string | undefined, ApiTypeNames>;
type pstsA2 = PositionalSchemaTypeSpecifierA<number, ApiTypeNames>;
type pstsA3 = PositionalSchemaTypeSpecifierA<MyOptional<number>, ApiTypeNames>;
type pstsA3a = PositionalSchemaTypeSpecifierA<number | undefined, ApiTypeNames>;
type pstsA4 = PositionalSchemaTypeSpecifierA<string[], ApiTypeNames>;
type pstsA5 = PositionalSchemaTypeSpecifierA<number[], ApiTypeNames>;

type PositionalTypeDef<T> = PositionalBase & PositionalSchemaTypeSpecifierA<T, ApiTypeNames>;

type MakePositionalSchema<T> = {
    [P in keyof T]: PositionalTypeDef<T[P]>;
}

interface Schema<Options, Positionals> {
    options: Options;
    positionals: Positionals
}

type CallParams<P> = P extends (...args: any) => any ? Parameters<P> : [];

type PositionalsForSignature<F> = MakePositionalSchema<CallParams<F>>
function exposeActionTypedExp<F extends (...args: any[]) => any, Options>(name: string, f: F, schema: Schema<Options, PositionalsForSignature<F>>) {

}

exposeActionTypedExp("x", listFiles, {
    options: {},
    positionals: [
        // { name: "folder", type: "number", required: true },
        // { name: "foo", type: "string", optional: true },
        { name: "folder", type: "number" },
        { name: "foo", type: "string?" }
    ]
});

type T2 = PositionalsForSignature<typeof listFiles>;
const t2: T2 = [
    // { name: "folder", type: "number", required: true },
    // { name: "foo", type: "string", optional: true }
    { name: "folder", type: "number" },
    { name: "foo", type: "string?" }
];

console.log("t2", t2)

//
// PoC code
//
async function listFiles(folder: number, foo: string | undefined): Promise<string[]> {
    return [".", ".bash_profile"];
}

//exposeAction("ls", listFiles, {
//    positional: [{ name: "folder", type: { type: "string" } }]
// });

function die(message: string): never {
    throw new Error(message);
}

function getModel(name: string): mongoose.Model<mongoose.Document> {
    return mongoose.models[name];
}

function findById(collection: string, id: string) {
    const model = getModel(collection) || die(`collection ${collection} not found`);
    const query: { [name: string]: any } = {};
    const dot_pos = id.indexOf(".");
    const eq_pos = id.indexOf("=");
    if (eq_pos !== -1) {
        const field = id.substr(0, eq_pos);
        let value: any = id.substr(eq_pos + 1);
        if (value.match(/^[0-9a-fA-F]{24}$/)) {
            value = new mongoose.Types.ObjectId(value);
        }
        query[field] = value;
    } else if (dot_pos !== -1) {
        // id.version
        query.id = id.substr(0, dot_pos);
        query.version = parseInt(id.substr(dot_pos + 1));
    } else if (id.match(/^[0-9a-fA-F]{24}$/)) {
        // mongo _id
        query._id = new mongoose.Types.ObjectId(id);
    } else {
        // latest
        query.id = id;
        query.row_status = "A";
    }

    console.debug("findOne query", query);
    return model.findOne(query);
}

function maybeParseValue(v: string): unknown {
    return v === "null"
        ? null
        : v === "true"
            ? true
            : v === "false"
                ? false
                : v.match(/^[0-9.]+$/)
                    ? parseFloat(v)
                    : v.match(/^[\{\[\'\"]/)
                        ? JSON.parse(v)
                        : v;
}

//
// args is list of mongodb query predicates in form
//
//    basic search
//      name=value -> { name: value} for exact match
//      name!=value -> { name: ${ ne: value} } for negative matches
//
//    subfield match
//      name.field=... -> { 'name.value': ... } - for dotted fields
//
//    mongo operators
//       if name ends with mongo operator ($eq, $anything) then predicate is made of 'name_part_without_operator: { $operator: value)'
//       example:
//         foo.bar.$exists = true  -> { 'foo.bar': { $exists: true } }
//
//    value of true/null/false/numbers are parsed to proper JS Boolean/Number so mongo accepts it
//
function find(collection: string, args: string[], options: any) {
    options = options || {};
    const model = getModel(collection) || die(`collection ${collection} not found`);

    const predicates = args.map(item => {
        const predicate: any = {};
        const eqPos = item.indexOf("=");
        if (eqPos === -1) {
            return { _id: maybeParseValue(item) };
        }
        if (eqPos === 0) {
            throw new Error('invalid predicate "' + item + '", = must follow field name');
        }
        let fieldName;
        let value = maybeParseValue(item.substr(eqPos + 1));
        let operator;
        if (item[eqPos - 1] == "!") {
            fieldName = item.substr(0, eqPos - 1);
            operator = "$ne";
        } else {
            fieldName = item.substr(0, eqPos);
        }
        const maybeExpr = fieldName.match(/(.+)\.(\$[a-zA-Z]+$)/);
        if (maybeExpr) {
            fieldName = maybeExpr[1];
            operator = maybeExpr[2];
        } else if (
            typeof value === "string" &&
            value.length >= 3 &&
            value[0] == "/" &&
            value[value.length - 1] == "/"
        ) {
            operator = "$regex";
            value = value.substr(1, value.length - 2);
        }
        if (operator === "$regex") {
            value = new RegExp(value as string);
        }
        if (operator && operator !== "$eq") {
            var opExpr: any = {};
            opExpr[operator] = value;
            predicate[fieldName] = opExpr;
        } else {
            predicate[fieldName] = value;
        }
        return predicate;
    }, {});
    var query;
    if (options.operator == "or") {
        query = { $or: predicates };
    } else {
        query = _.reduce(predicates, _.assignIn, {});
    }
    console.debug("#find query", JSON.stringify(query));

    let r = model.find(query as any);
    if (options.sort && _.isString(options.sort)) {
        const sort = options.sort.split(",").map(function (sv: string) {
            if (sv[0] == "-") {
                return [sv.substr(1), "descending"];
            } else if (sv[0] == "+") {
                return [sv.substr(1), "ascending"];
            } else {
                return [sv, "ascending"];
            }
        });
        r = r.sort(sort);
    }
    if (options.offset) {
        r = r.skip(parseInt(options.offset));
    }
    if (options.limit) {
        r = r.limit(parseInt(options.limit));
    }
    return r;
}

//
// this should be project-dependent
//
// TODO: ./.mongoose-cli-config.js should export async `initializer`
// function() => Promise<() => Promise<void>
// meaning,
//


async function processDoc<T extends mongoose.Document>(doc: T | null) {
    console.log(doc ? doc.toObject() : "not found");
}

async function initializeMongoose() {
    const ourMongoose = require("mongoose");
    return async () => {
        await ourMongoose.connection.close();
    };
}

export function processQueryOrCursor<T extends mongoose.Document>(
    collection_promise: mongoose.DocumentQuery<T[], T> | any[] | Promise<any[]>,
    iteratee: (v: T) => void | Promise<void>
) {
    let source: mongoose.QueryCursor<T> | undefined;
    let running = 0;
    let limit = 10;

    const taskStarted = function () {
        running = running + 1;
        if (source && running > limit) {
            source.pause();
        }
    };
    const taskFinished = function () {
        running = running - 1;
        if (source && running < limit) {
            source.resume();
        }
    };
    var processItem = function (item: T) {
        let p: Promise<void> | void;
        try {
            p = iteratee(item);
        } catch (err) {
            console.error("sync exception during processing %s: %s", (item._id), err);
            // log("%s", JSON.stringify(item, 0, 2));
            console.error(err.stack);
            return Promise.resolve();
        }
        taskStarted();
        return Promise.resolve(p)
            .then(function (r) {
                taskFinished();
                return r;
            })
            .catch(function (error) {
                console.error("async exception during processing %s: %s", (item._id), error);
                // log("%s", JSON.stringify(item, 0, 2));
                console.error(error.stack);
                taskFinished();
                return Promise.resolve();
            });
    };
    if ("cursor" in collection_promise) {
        source = collection_promise.cursor();
        return new Promise(function (resolve, reject) {
            const promises: Promise<void>[] = [];
            source!
                .on("data", function (doc: T) {
                    promises.push(processItem(doc));
                })
                .on("error", reject)
                .on("end", function () {
                    Promise.all(promises).then(resolve, reject);
                });
        });
    } else {
        return bluebirdMap(collection_promise, processItem, {
            concurrency: limit
        });
    }
}

function exposeMongooseCollection(collection: string) {
    // exposeAction(`${collection}.get`, async (id: string) => {
    //     await processDoc(await findById(collection, id));
    // }, { positional: [
    //     { type: "string"}
    // ]});
    // exposeAction(`${collection}.findOne`, async (id: string) => {
    //     await processDoc(await findById(collection, id));
    // }, { });
    // exposeAction(`${collection}.find`, async (params: string[]) => {
    //     return processQueryOrCursor(find(collection, params, {}), processDoc);
    // }, { });
}

useMiddleware(initializeMongoose);

exposeMongooseCollection("food");
exposeMongooseCollection("meal");

cliRunDefault();

