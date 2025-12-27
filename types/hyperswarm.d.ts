declare module "hyperswarm" {
  import { EventEmitter } from "stream";
  import { Duplex } from "streamx";
  type Key = Buffer | Uint8Array;
  interface KeyPair {
    publicKey: Key;
    secretKey: Key;
  }
  interface SwarmOpts {
    keyPair?: KeyPair;
    seed?: Key;
    maxKeys?: number;
    firewall?: (remotePublicKey: Key) => boolean
  }
  type Connection = Duplex;
  interface PeerInfo {
    readonly publicKey: Key;
    readonly topics: Key[];
    readonly prioritized: boolean;
    ban(banStatus: boolean): void;
  }
  interface JoinOpts {
    server?: boolean;
    client?: boolean;
  }
  interface PeerDiscovery {
    flushed(): Promise<void>;
    destroy(): Promise<void>;
    refresh(joinOpts: JoinOpts): Promise<void>;
  }
  interface SwarmEvents {
    close: [];
    connection: [connection: Connection, peer: PeerInfo];
    update: [];
    ban: [peerInfo: PeerInfo, err: Error];
  }
  export default class Hyperswarm extends EventEmitter<SwarmEvents> {
    keyPair: KeyPair;
    connections: Connection[];
    peers: Map<string, PeerInfo>;

    constructor(opts?: SwarmOpts);

    flush(): Promise<void>;
    join(topic: Key, joinOpts?: JoinOpts): PeerDiscovery;
    leave(topic: Key): Promise<void>;
    joinPeer(topic: Key): void;
    leavePeer(topic: Key): void;
    destroy(): Promise<void>;
    listen(): Promise<void>;
    suspend(): Promise<void>;
    resume(): Promise<void>;
  }
}
