declare module "corestore" {
  import type { Connection } from "hyperswarm";
  import type { CoreOpts } from "hypercore";
  import type Hypercore from "hypercore";
  import type RocksDB from "rocksdb-native";
  interface CoreStoreOpts {}
  export default class CoreStore {
    constructor(storage: strin | RocksDB, opts: CoreStoreOpts?);
    namespace(namespace: string): CoreStore;
    get<DataType>(opts: CoreOpts): Hypercore<DataType>;
    ready(): Promise<void>
    close(): Promise<void>
    createKeyPair(name: string): KeyPair
    replicate(connection: Connection)
  }
}
