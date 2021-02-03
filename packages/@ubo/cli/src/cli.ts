import * as path from "path";
import { inUboContext } from "@ubo/core";

export interface Config {
  appName: string;
}

function fillConfigDefaults(config?: Partial<Config>): Config {
  return {
    appName: config?.appName ?? path.basename(process.argv[1]),
  };
}

function optionalParam(args: string[]): string | undefined;
function optionalParam(args: string[], fallback: string): string;

function optionalParam(args: string[], fallback?: string | undefined): string | undefined {
  if (args.length > 0) {
    return args.shift();
  } else {
    return fallback;
  }
}

function die(message: string): never {
  throw new Error(message);
}

function mandatoryParam(args: string[], failMessage: string) {
  return optionalParam(args) || die(failMessage);
}

export async function main(args: string[], options?: Partial<Config>): Promise<void> {
  const action = mandatoryParam(args, "action is required");
  inUboContext(async (context) => {
    console.log("hello", action, context);
  });
}

export function cliRunDefault(options?: Partial<Config>) {
  options = fillConfigDefaults(options);
  main(process.argv.slice(2), options).catch((error) => {
    console.error(`${options?.appName}`, error);
  });
}
