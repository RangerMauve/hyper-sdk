declare module "hypercore" {
  import type RocksDB from "rocksdb-native";
  interface CoreOpts {}
  export default class Hypercore {
    constructor(storage: string | RocksDB, opts?: CoreOpts);
    key: Buffer;
    discoveryKey: Buffer;
    discovery: object;
    writable: boolean;
    length: number;
    findingPeers(): ()=>void;
    ready(): Promise<void>;
    update(): Promise<void>;
    close(): Promise<void>;

    once(event: 'close', cb: ()=>void)
    on(event: 'close', cb: ()=>void)
  }
}
