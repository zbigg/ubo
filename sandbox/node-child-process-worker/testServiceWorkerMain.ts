import { interval, Observable } from "rxjs";
import { map, take, tap } from "rxjs/operators";
import { startChildProcessWorkerServiceAdapter } from "./ChildProcessWorkerServicePart";
import { SampleService } from "./test";

class ServiceImpl implements SampleService {
  async getFoo(name: string): Promise<string> {
    return `foo: ${name}`;
  }
  foo(): Observable<string> {
    return interval(500).pipe(
      take(5),
      map(String),
      tap((x) => console.log("ServiceImpl#send", x))
    );
  }
}

startChildProcessWorkerServiceAdapter(new ServiceImpl());
