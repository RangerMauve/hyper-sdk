declare module "hyperswarm" {
  interface SwarmOpts {
    keyPair?: KeyPair;
  }
  interface Connection {
    once(event: "close", cb: () => void): void;
  }
  interface PeerInfo {}
  interface JoinOpts {
    server?: boolean;
    client?: boolean;
  }
  interface PeerDiscovery {
    flushed(): Promise<void>;
    destroy(): Promise<void>;
  }
  export default class Hyperswarm {
    keyPair: KeyPair;
    connections: Connection[];
    peers: Map<string, PeerInfo>;

    constructor(opts: SwarmOpts);

    on(
      event: "connection",
      cb: (connection: Connection, peer: PeerInfo) => void
    ): void;
    flush(): Promise<void>;
    join(topic: Buffer, joinOpts?: JoinOpts): PeerDiscovery;
    leave(topic: Buffer): Promise<void>;
    joinPeer(topic: Buffer): void;
    leavePeer(topic: Buffer): void;
    destroy(): Promise<void>;
    listen(): Promise<void>;
  }
}
