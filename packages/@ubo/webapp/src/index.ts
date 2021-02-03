import * as express from "express";

import { ExecutionContext } from "@ubo/core";

export interface Configuration {}

// Not sure what i meant
// interface Action extends Action {}

export async function createUboApi(
  context: ExecutionContext,
  config?: Configuration
): Promise<express.Router> {
  const router = express.Router();
  // TODO:
  // TODO: serve api
  return router;
}

export async function createUboWebApp(
  context: ExecutionContext,
  config?: Configuration
): Promise<express.Router> {
  const router = express.Router();
  // TODO:
  // TODO: serve webapp
  return router;
}
