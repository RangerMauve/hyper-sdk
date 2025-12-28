declare module "hypercore" {
  import { EventEmitter } from "node:events";
  import type RocksDB from "rocksdb-native";

  type Key = Buffer | Uint8Array;
  interface KeyPair {
    publicKey: Key;
    secretKey: Key;
  }

  type EncodingType = "json" | "utf-8" | "binary";
  type Stringable = string | { toString(): string };

  // Plain JSON object based on this stack overflow answer
  // https://stackoverflow.com/a/59647842
  type Primitive = bigint | boolean | null | number | string;
  type JSONValue = Primitive | JSONObject | JSONArray;
  interface JSONObject {
    [key: string]: JSONValue;
  }
  interface JSONArray extends Array<JSONValue> {}

  interface CoreOpts {
    valueEncoding?: EncodingType;
    keyPair?: KeyPair;
    encryption?: { key: Key };
    timeout?: number;
    writable?: boolean;
    inflightRange?: [number, number];
    userData?: { [key: string]: any };
    key?: Key;
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

  interface Peer {
    remotePublicKey: Key;
    readonly paused: boolean;
    readonly removed: boolean;
    readonly extensions: Map<string, Extension>
  }

  interface Extension<Encoding = Buffer | Uint16Array> {
    send(message: Encoding, peer: Peer): void;
    broadcast(message: Encoding): void;
    destroy(): void;
  }

  interface ExtensionOpts<Encoding = Buffer | Uint8Array> {
    onmessage: (message: Encoding, peer: Peer) => void;
  }

  interface HypercoreEvents {
    close: [];
    ready: [];
    append: [];
    "peer-add": [peer: Peer];
    "peer-remove": [peer: Peer];
    upload: [index: number, byteLength: number, peer: Peer];
    download: [index: number, byteLength: number, peer: Peer];
  }

  export default class Hypercore<
    DataType = string | Buffer | Uint8Array
  > extends EventEmitter<HypercoreEvents> {
    constructor(storage: string | RocksDB, opts?: CoreOpts);
    readonly key: Buffer;
    readonly url: string;
    readonly id: string;
    readonly discoveryKey: Buffer;
    discovery: object;
    readonly writable: boolean;
    readonly length: number;
    readonly closed: boolean;
    readonly peers: Peer[];
    readonly extensions: Map<string, Extension>

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
    registerExtension(
      name: string,
      extensionOpts: ExtensionOpts<string> & { encoding: "utf-8" }
    ): Extension<Stringable>;
    registerExtension(
      name: string,
      extensionOpts: ExtensionOpts<Buffer | Uint8Array> & {
        encoding?: "buffer";
      }
    ): Extension<Buffer | Uint8Array>;
    registerExtension<Encoding = JSONValue>(
      name: string,
      extensionOpts: ExtensionOpts<Encoding> & { encoding: "json" }
    ): Extension<Encoding>;
  }
}
