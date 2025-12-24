declare module "hypercore" {
  import type RocksDB from "rocksdb-native";

  type EncodingType = "json" | "utf-8" | "binary"
  interface CoreOpts {
    valueEncoding?: EncodingType;
    keyPair?: KeyPair;
    encryption?: { key: Buffer };
    timeout?: number;
    writable?: boolean;
    inflightRange?: [number, number];
    userData?: { [key: string]: any };
    key?: string;
  }
  interface GetOpts {
    wait?: boolean;
    onwait?: () => void;
    timeout?: number;
    activeRequests?: any[];
    valueEncoding?: EncodingType;
    decrypt?: boolean;
    raw?: boolean;
  }
  interface Peer {}
  export default class Hypercore<DataType = string | Buffer | Uint8Array> {
    constructor(storage: string | RocksDB, opts?: CoreOpts);
    key: Buffer;
    url: string;
    id: string;
    discoveryKey: Buffer;
    discovery: object;
    writable: boolean;
    length: number;
    closed: boolean;
    peers: Peer[];

    findingPeers(): () => void;
    ready(): Promise<void>;
    update(options?: {
      wait?: false;
      activeRequests?: any[];
      force?: false;
    }): Promise<boolean>;
    close(options?: { error?: Error }): Promise<void>;
    get(index: number, opts?: GetOpts): Promise<DataType>;
    append(
      data: DataType | DataType[],
      options?: { writable?: boolean }
    ): Promise<number>;

    on(event: "close", cb: () => void);
    on(event: "ready", cb: () => void);
    on(event: "append", cb: () => void);
    on(event: "peer-add", cb: (peer: Peer) => void);
    on(event: "peer-remove", cb: (peer: Peer) => void);
    on(event: "upload", index: number, byteLength: number, peer: Peer): void;
    on(event: "download", index: number, byteLength: number, peer: Peer): void;
    
    once(event: "close", cb: () => void);
    once(event: "ready", cb: () => void);
    once(event: "append", cb: () => void);
    once(event: "peer-add", cb: (peer: Peer) => void);
    once(event: "peer-remove", cb: (peer: Peer) => void);
    once(event: "upload", index: number, byteLength: number, peer: Peer): void;
    once(event: "download", index: number, byteLength: number, peer: Peer): void;
  }
}
