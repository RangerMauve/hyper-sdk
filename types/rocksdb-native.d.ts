declare module "rocksdb-native" {
  import type { Encoder } from "compact-encoding";

  interface SessionOpts {
    valueEncoding?: Encoder;
    keyEncoding?: Encoder;
    columnFamily?: string;
    readOnly?: boolean;
  }

  interface IteratorOpts<Key> {
    gt?: Key;
    gte?: Key;
    lt?: Key;
    lte?: Key;
    reverse?: boolean;
    limit?: number;
    values?: boolean;
    keys?: boolean;
  }

  interface Entry<Key, Value> {
    key: Key;
    value: Value;
  }

  /**
   * RocksDB-Native Instance.
   * **WARNING**: This is a stub used in hyper-sdk.
   * Most methods are not yet documented
   */
  export default class RocksDB<Key = string, Value = string> {
    constructor(storageLocation: string, options?: SessionOpts);
    put(key: Key, value: Value): Promise<void>;
    get(key: Key): Promise<Value?>;
    delete(key: Key): Promise<void>;
    flush(): Promise<void>;
    close(): Promise<void>;
    session<SubKey = Key, SubValue = Value>(
      options?: SessionOpts
    ): RocksDB<SubKey, SubValue>;
    iterator(
      range?: IteratorOpts,
      options?: IteratorOpts
    ): AsyncIterable<Entry<Key, Value>>;
  }
}
