declare module "corestore" {
  import type { Connection } from "hyperswarm";
  import type { CoreOpts } from "hypercore";
  import type Hypercore, { Key, KeyPair } from "hypercore";
  import type RocksDB from "rocksdb-native";
  import { Readable } from "streamx";
  interface CoreStoreOpts {
    writable?: boolean;
    readOnly: boolean;
    primaryKey?: Key;
    unsafe?: boolean;
  }
  type GetOpts = CoreOpts | { name: string } | { key: Key };
  export default class CoreStore {
    constructor(storage: string | RocksDB, opts: CoreStoreOpts?);
    get<DataType>(opts: GetOpts): Hypercore<DataType>;
    ready(): Promise<void>;
    close(): Promise<void>;
    namespace(namespace: string): CoreStore;
    session(): CoreStore;
    list(namespace?: string): Readable<Key>;
    watch(cb: (core: Hypercore) => void);
    unwatch(cb: (core: Hypercore) => void);
    suspend(): Promise<void>;
    resume(): Promise<void>;
    createKeyPair(name: string): KeyPair;
    replicate(connection: Connection);
  }
}
