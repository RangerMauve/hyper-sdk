declare module "hyperdrive" {
  import type Hypercore from "hypercore";
  import type CoreStore from "corestore";

  interface DriveOpts {

  }

  export default class Hyperdrive {
    core: Hypercore;

    constructor(store: CoreStore, key: Buffer|Uint8Array|null, opts?: DriveOpts);

    ready(): Promise<void>;
    close(): Promise<void>;

    once(event: 'close', cb: ()=>void)
    on(event: 'close', cb: ()=>void)
  }
}
