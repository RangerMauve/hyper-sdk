declare module "hyperbee" {
  import type { EncodingType } from "hypercore";
  import type Hypercore from "hypercore";
  import { EventEmitter } from "events";

  interface BeeOpts<Key = Buffer, Value = Buffer> {
    keyEncoding?: EncodingType;
    valueEncoding?: EncodingType;
  }

  interface Entry<Key = Buffer, Value = Buffer> {
    seq: number;
    key: Key;
    value: Value;
  }

  interface Range {
    gt?: any;
    gte?: any;
    lt?: any;
    lte?: any;
  }

  interface BatchOptions {
    cas?(prev: any, next: any): boolean;
  }

  interface Watcher extends EventEmitter {
    node: Entry | null;

    on(event: "update", cb: () => void);
    close(): Promise<void>;
  }

  interface SubOpts<Key = Buffer> {
    sep?: Buffer;
    valueEncoding?: EncodingType;
    keyEncoding?: EncodingType;
  }

  export default class Hyperbee<
    Key = Buffer,
    Value = Buffer
  > extends EventEmitter {
    constructor(core: Hypercore, opts?: BeeOpts<Key, Value>);

    url: string;
    key: Buffer;
    version: number;

    ready(): Promise<void>;

    put(key: Key, [value]?: Value, [options]?: BatchOptions): Promise<boolean>;
    get(key: Key): Promise<Entry<Key, Value> | null>;
    del(key: Key, [options]?: BatchOptions): Promise<boolean>;
    getBySeq(seq: number, options?: {}): Promise<Entry<Key, Value> | null>;
    createReadStream(
      range?: Range,
      options?: {}
    ): AsyncIterable<{ key: Key; value: Value }>;
    peek(range?: Range, options?: {}): Promise<Entry<Key, Value>>;
    createHistoryStream(options?: {});
    createDiffStream(
      otherVersion: Hyperbee,
      options?: Range
    ): AsyncIterable<{
      left: Entry<Key, Value> | null;
      right: Entry<Key, Value> | null;
    }>;
    getAndWatch(key: Key, [options]?: {}): Promise<Watcher>;
    watch(range?: Range): Watcher;
    checkout(version: number): Hyperbee<Key, Value>;
    snapshot(): Hyperbee<Key, Value>;
    sub(prefix: string, options?: SubOpts<Key>): Hyperbee<Key, Value>;

    close(): Promise<void>;

    writable: boolean;
    readable: boolean;
    core: any;
  }
}
