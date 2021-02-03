import { schema } from "./schema";

export interface ArgumentSchema {
  name: string;
  required?: boolean;
  type: schema.Type;
}

export interface ActionSchema {
  positional?: ArgumentSchema[];
  parameters?: ArgumentSchema[];
  bodySchema?: schema.Type;
  responseSchema?: schema.Type;
}

interface ActionInfo {
  name: string;
  fullName: string;
  group: string;
  schema: ActionSchema;
}

interface InvocationContext {
  positional?: unknown[];
  parameters?: [string, unknown][];
  body?: unknown;

  // auth
  // cancellationToken
}
export interface ActionResponse {}
export interface Action extends ActionInfo {
  invoke(context: InvocationContext): Promise<unknown>;
}

export type Cleanup = () => Promise<void>;
export type Middleware = (ubo: DeclarationContext) => Cleanup | Promise<Cleanup>;

export interface DeclarationContext {
  use(middleware: Middleware): DeclarationContext;
  exposeAction(name: string, fun: () => Promise<unknown>, schema: ActionSchema): void;
  // exposeModel(model: Model, model: ModelSchema)
  addCleanup(cleanup: Cleanup): void;
}

export function exposeAction(name: string, fun: () => Promise<unknown>, schema: ActionSchema) {
  defaultDeclarationContext.exposeAction(name, fun, schema);
}

export function useMiddleware(middleware: Middleware) {
  defaultDeclarationContext.use(middleware);
}

export interface ExecutionContext extends DeclarationContext {
  middleware: Middleware[];
  cleanups: Cleanup[];
  actions: Action[];
  prefix: string;
}

export class DeclarationContextImpl implements ExecutionContext, DeclarationContext {
  readonly middleware: Middleware[] = [];
  readonly cleanups: Cleanup[] = [];
  readonly actions: Action[] = [];
  readonly prefix: string = "";

  use(middleware: Middleware): this {
    this.middleware.push(middleware);
    return this;
  }
  exposeAction(name: string, fun: () => Promise<unknown>, schema: ActionSchema) {
    this.actions.push({
      name,
      fullName: name,
      group: "",
      schema,
      invoke: (context: InvocationContext) => {
        return fun();
      },
    });
  }
  addCleanup(cleanup: Cleanup) {
    this.cleanups.unshift(cleanup);
  }
}

export const defaultDeclarationContext = new DeclarationContextImpl();

async function loadMiddlewares(context: ExecutionContext, paths: string[]) {
  for (const middleware of context.middleware) {
    if (typeof middleware !== "function") {
      throw new Error(`ubo-core#: invalid middleware: ${middleware}`);
    }
    const middlewareName = middleware.name || "anynomous middleware";
    const cleanup = await Promise.resolve(middleware(context)).catch((error) => {
      console.error(`ubo-core: failed to initialize ${middlewareName}: ${error}`, error);
      throw new Error(`ubo-core: Failed to load middleware`);
    });
    if (cleanup) {
      context.addCleanup(cleanup);
    }
  }

  for (const middlewarePath of paths) {
    let middleware = require(middlewarePath);
    if (typeof middleware !== "function") {
      if (typeof middleware.default === "function") {
        middleware = middleware.default;
      }
      throw new Error(`ubo-core#: middleware ${middlewarePath} should export function`);
    }
    const cleanup = await Promise.resolve(middleware(context)).catch((error) => {
      console.error(`ubo-core: failed to initialize ${middlewarePath}: ${error}`, error);
      throw new Error(`ubo-core: Failed to load middleware`);
    });
    if (cleanup) {
      context.addCleanup(cleanup);
    }
  }
}

async function cleanup(context: DeclarationContextImpl) {
  for (const cleanup of context.cleanups) {
    await cleanup();
  }
}

export async function inUboContext(
  fun: (context: ExecutionContext) => Promise<void | (() => Promise<void>)>
): Promise<void> {
  const context = defaultDeclarationContext;
  try {
    await loadMiddlewares(context, ["./ubo-config"]);
    const callback = await fun(context);
    if (typeof callback === "function") {
      context.addCleanup(callback);
    }
  } finally {
    await cleanup(context);
  }
}
