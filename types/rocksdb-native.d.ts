declare module "rocksdb-native" {
  export default class RocksDB {
    constructor(storageLocation: string);
    put(key: string, value: string): Promise<void>;
    get(key: string): string?;
    flush(): Promise<void>;
    close(): Promise<void>;
  }
}
