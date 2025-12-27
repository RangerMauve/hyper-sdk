declare module "hyperbee" {
  import type { EncodingType } from "hypercore";
  import type Hypercore, { Key } from "hypercore";
  import { EventEmitter } from "events";

  interface BeeOpts<Key = Buffer, Value = Buffer> {
    keyEncoding?: EncodingType;
    valueEncoding?: EncodingType;
  }

  interface Entry<Key = Buffer, Value = Buffer> {
    readonly seq: number;
    readonly key: Key;
    readonly value: Value;
  }

  type HistoryEntry<Key, Value> = Entry<Key, Value> & {
    readonly type: "put" | "del";
  };

  interface Range<Key> {
    gt?: Key;
    gte?: Key;
    lt?: Key;
    lte?: Key;
  }

  interface BatchOptions<Key, Value> {
    cas?(prev: Entry<Key, Value>, next: Entry<Key, Value>): boolean;
  }

  type DBWatcher<Key, Value> = AsyncIterable<
    Hyperbee<Key, Value> & { close(): Never }
  > & {
    ready(): Promise<void>;
    close(): Promise<void>;
  };

  type KeyWatcher<Key, Value> = EventEmitter<{ update: [] }> & {
    readonly node: Entry<Key, Value>;
    close(): Promise<void>;
  };

  interface SubOpts<Key = Buffer> {
    sep?: Buffer;
    valueEncoding?: EncodingType;
    keyEncoding?: EncodingType;
  }

  interface ReadStreamOpts {
    reverse?: boolean;
    limit?: number;
  }

  type HistoryOpts = Range<number> &
    ReadStreamOpts & {
      live?: boolean;
    };

  interface Batch<Key, Value> {
    put(key: Key, [value]?: Value, [options]?: BatchOptions): Promise<boolean>;
    get(key: Key): Promise<Entry<Key, Value> | null>;
    del(key: Key, [options]?: BatchOptions<Key, Value>): Promise<boolean>;
    flush(): Promise<void>;
    close(): Promise<void>;
  }

  export default class Hyperbee<
    Key = Buffer,
    Value = Buffer
  > extends EventEmitter {
    constructor(core: Hypercore, opts?: BeeOpts<Key, Value>);

    readonly url: string;
    readonly id: string;
    readonly writable: boolean;
    readonly readable: boolean;
    readonly key: Key;
    readonly discoveryKey: Key;
    readonly version: number;
    readonly core: Hypercore;

    ready(): Promise<void>;

    put(key: Key, [value]?: Value, [options]?: BatchOptions): Promise<boolean>;
    get(key: Key): Promise<Entry<Key, Value> | null>;
    del(key: Key, [options]?: BatchOptions<Key, Value>): Promise<boolean>;
    batch(): Batch<Key, Value>;
    getBySeq(seq: number, options?: {}): Promise<Entry<Key, Value> | null>;
    createReadStream(
      range?: Range<Key>,
      options?: ReadStreamOpts
    ): AsyncIterable<Entry<Key, Value>>;
    peek(
      range?: Range<Key>,
      options?: ReadStreamOpts
    ): Promise<Entry<Key, Value>>;
    createHistoryStream(
      options?: HistoryOpts
    ): AsyncIterable<HistoryEntry<Key, Value>>;
    createDiffStream(
      otherVersion: Hyperbee,
      options?: Range<Key>
    ): AsyncIterable<{
      left: Entry<Key, Value> | null;
      right: Entry<Key, Value> | null;
    }>;
    getAndWatch(key: Key, options?: {}): Promise<KeyWatcher<Key, Value>>;
    watch(range?: Range<Key>): DBWatcher<Key, Value>;
    checkout(version: number): Hyperbee<Key, Value>;
    snapshot(): Hyperbee<Key, Value>;
    sub(prefix: string, options?: SubOpts<Key>): Hyperbee<Key, Value>;

    close(): Promise<void>;
  }
}
