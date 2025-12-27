declare module "hyperdrive" {
  import { EventEmitter } from "node:stream";
  import type Hypercore from "hypercore";
  import type Hyperbee from "hyperbee";
  import type CoreStore from "corestore";

  interface DriveOpts {
    key?: Buffer | Uint8Array;
  }

  interface Entry {
    seq: number;
    key: string;
    value: {
      executable: boolean;
      linkname: null | string;
      blob: {
        blockOffset: number;
        blockLength: number;
        byteOffset: number;
        byteLength: number;
      };
      metadata: any | null;
    };
  }

  interface WriteOptions {
    executable?: boolean;
    metadata: { [string]: any };
  }

  interface ReadOptions {
    wait?: boolean;
    timeout?: number;
    start?: number;
    end?: number;
    length?: number;
  }

  interface ListOptions {
    recursive?: boolean;
    ignore?: string | string[];
    wait?: boolean;
  }

  type EntryOptions = ReadOptions & {
    follow?: boolean;
  };

  interface Diff {
    left: Entry;
    right: Entry;
  }

  interface Download {
    done(): Promise<void>;
    destroy(): void;
  }

  interface HypedriveEvents {
    close: [];
  }

  type UncloseableDrive = Hyperdrive & {
    close(): never;
  };

  interface MirrorDriveOptions {
    prefix?: string;
    dryRun?: boolean;
    prune?: boolean;
    includeEquals?: boolean;
    filter: (key: string) => boolean;
    batch?: boolean;
    ignore?: string | string[];
  }
  interface MirrorEvent {
    op: "add";
    key: string;
    bytesRemoved: number;
    bytesAdded: number;
  }
  type MirrorDrive = AsyncIterable<MirrorEvent> & {
    readonly count: number;
    done: Promise<void>;
  };

  export default class Hyperdrive extends EventEmitter<HyperdriveEvents> {
    readonly url: string;
    readonly id: string;
    readonly writable: boolean;
    readonly readable: boolean;
    readonly key: Key;
    readonly discoveryKey: Key;
    readonly version: number;
    readonly supportsMetadata: true;

    readonly core: Hypercore;
    readonly corestore: CoreStore;
    readonly db: Hyperbee<string, Entry>;

    constructor(
      store: CoreStore,
      key: Buffer | Uint8Array | null,
      opts?: DriveOpts
    );

    ready(): Promise<void>;
    close(): Promise<void>;

    put(
      path: string,
      buffer: Uint8Array,
      options?: WriteOptions
    ): Promise<void>;
    get(path: string, options?: ReadOptions): Promise<Uint8Array | null>;
    entry(path: string, options?: EntryOptions): Promise<Entry>;
    exists(path: string): Promise<boolean>;
    del(path: string): Promise<void>;
    compare(entryA: Entry, entryB: Entry): number;
    clear(path: string, options?: { diff?: boolean }): Promise<number | null>;
    clearAll(options?: { diff?: boolean }): Promise<number | null>;
    truncate(
      version: number,
      options?: { blobs?: number }
    ): Promise<void | number>;
    purge(): Promise<void>;
    symlink(path: string, linkname: string): Promise<void>;
    batch(): Hyperdrive & { flush(): Promise<void> };
    list(folder: string, options?: ListOptions): AsyncIterable<Entry>;
    readdir(
      folder: string,
      options?: { wait?: boolean }
    ): AsyncIterable<string>;
    has(path: string): Promise<boolean>;
    entries: Hyperbee<string, Entry>["createReadStream"];
    mirror(out: Hyperdrive, options?: MirrorDriveOptions): MirrorDrive;
    watch(folder?: string): AsyncIterable<[UncloseableDrive, UncloseableDrive]>;
    ready(): Promise<void>;
    destroy(): void;
    createReadStream(path: string, options?: ReadOptions): any;
    createWriteStream(path: string, options?: WriteOptions): any;
    download(folder: string, options?: ListOptions): Download;
    checkout(version: number): Hyperdrive;
    diff(version: number, folder: string, options?: any): AsyncIterable<Diff>;
    downloadDiff(version: number, folder: string, options?: any): Download;
    downloadRange(dbRanges: any, blobRanges: any): Download;
    findingPeers(): () => void;
    update(options?: { wait: boolean }): Promise<boolean>;
  }
}
