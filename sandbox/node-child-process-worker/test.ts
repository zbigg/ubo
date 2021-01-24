import { ChildProcessWorker } from "./ChildProcessWorkerClient";
import * as path from "path";
import { createProxyServiceCommunicator } from "../ServiceCommunicator";
import { Observable, Subscription } from "rxjs";

export interface SampleService {
  getFoo(name: string): Promise<string>;
  foo(): Observable<string>;
}

async function main() {
  const worker = new ChildProcessWorker(path.resolve(__dirname, "./testServiceWorkerMain"));

  const sampleService = createProxyServiceCommunicator<SampleService>(worker.port);

  const y = await sampleService.getFoo("abc");
  console.log("#getStaticService(y) ->", y);

  const z = sampleService.foo(); // as unknown as Observable<string>;

  let subscription: Subscription | undefined = undefined;
  await new Promise<void>((resolve, reject) => {
    subscription = z.subscribe(
      (next) => console.log("z#next", next),
      (error) => {
        console.log("z#error", error);
        reject(error);
      },
      () => {
        console.log("z#done");
        resolve();
      }
    );
  });
  subscription!.unsubscribe();

  worker.stop();
}

main().catch((error) => {
  console.error("??", error);
  process.abort();
});
