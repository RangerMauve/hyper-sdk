declare module "hyperdrive" {
  import type Hypercore from "hypercore";
  import type CoreStore from "corestore";

  interface DriveOpts {
    key?: Buffer|Uint8Array;
  }

  interface Entry {
    seq: number;
    key: string;
    value: {
      executable: boolean;
      linkname: null|string;
      blob: {
        blockOffset: number;
        blockLength: number;
        byteOffset: number;
        byteLength: number;
      };
      metadata: any|null;
    };
  }

  interface Download {
    done(): Promise<void>;
    destroy(): void;
  }

  export default class Hyperdrive {
    core: Hypercore;
    url: string;
    key: Buffer;

    constructor(store: CoreStore, key: Buffer|Uint8Array|null, opts?: DriveOpts);

    ready(): Promise<void>;
    close(): Promise<void>;

    once(event: 'close', cb: () => void);
    on(event: 'close', cb: () => void);

    put(path: string, buffer: Uint8Array, options?: any): Promise<void>;
    get(path: string, options?: { wait?: boolean; timeout?: number }): Promise<Uint8Array|null>;
    entry(path: string, options?: { follow?: boolean; wait?: boolean; timeout?: number }): Promise<Entry>;
    exists(path: string): Promise<boolean>;
    del(path: string): Promise<void>;
    compare(entryA: Entry, entryB: Entry): number;
    clear(path: string, options?: { diff?: boolean }): Promise<number|null>;
    clearAll(options?: { diff?: boolean }): Promise<number|null>;
    truncate(version: number, options?: { blobs?: number }): Promise<void|number>;
    purge(): Promise<void>;
    symlink(path: string, linkname: string): Promise<void>;
    batch(): Hyperdrive;
    flush(): Promise<void>;
    list(folder: string, options?: { recursive?: boolean; ignore?: string|string[]; wait?: boolean }): any;
    readdir(folder: string, options?: { wait?: boolean }): any;
    entries(range?: any, options?: any): any;
    mirror(out: Hyperdrive, options?: any): MirrorDrive;
    watch(folder?: string): AsyncIterable<[Snapshot, Snapshot]>;
    ready(): Promise<void>;
    destroy(): void;
    createReadStream(path: string, options?: { start?: number; end?: number; length?: number; wait?: boolean; timeout?: 0 }): any;
    createWriteStream(path: string, options?: { executable?: boolean; metadata?: any }): any;
    download(folder: string, options?: any): Download;
    checkout(version: number): Hyperdrive;
    diff(version: number, folder: string, options?: any): any;
    downloadDiff(version: number, folder: string, options?: any): Download;
    downloadRange(dbRanges: any, blobRanges: any): Download;
    has(path: string): Promise<boolean>;
  }

  interface Snapshot {
    version: number;
    close(): void;
  }
}