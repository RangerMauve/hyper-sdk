declare module "rocksdb-native" {
  /**
   * RocksDB-Native Instance.
   * **WARNING**: This is a stub used in hyper-sdk.
   * Most methods are not yet documented
   */
  export default class RocksDB {
    constructor(storageLocation: string);
    put(key: string, value: string): Promise<void>;
    get(key: string): string?;
    flush(): Promise<void>;
    close(): Promise<void>;
  }
}
