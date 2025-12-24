/**
 *
 * @param {object} options
 * @param {string} [options.storage]
 * @param {CoreStoreOpts} [options.corestoreOpts]
 * @param {SwarmOpts} [options.swarmOpts]
 * @param {typeof globalThis["fetch"]} [options.fetch]
 * @param {HyperSwarm} [options.swarm]
 * @param {CoreStore} [options.corestore]
 * @param {RocksDB} [options.dnsCache]
 * @param {CoreOpts} [options.defaultCoreOpts]
 * @param {JoinOpts} [options.defaultJoinOpts]
 * @param {string} [options.dnsResolver]
 * @param {boolean} [options.autoJoin=true]
 * @param {boolean} [options.doReplicate=true]
 * @returns {Promise<SDK>}
 */
export function create({ storage, corestoreOpts, swarmOpts, fetch, ...opts }?: {
    storage?: string | undefined;
    corestoreOpts?: CoreStoreOpts | undefined;
    swarmOpts?: SwarmOpts | undefined;
    fetch?: typeof globalThis.fetch | undefined;
    swarm?: HyperSwarm | undefined;
    corestore?: CoreStore | undefined;
    dnsCache?: RocksDB | undefined;
    defaultCoreOpts?: CoreOpts | undefined;
    defaultJoinOpts?: JoinOpts | undefined;
    dnsResolver?: string | undefined;
    autoJoin?: boolean | undefined;
    doReplicate?: boolean | undefined;
}): Promise<SDK>;
/** @import {JoinOpts,SwarmOpts,PeerDiscovery,Connection} from "hyperswarm" */
/** @import {BeeOpts} from "hyperbee" */
/** @import {CoreOpts} from "hypercore" */
/** @import {DriveOpts} from "hyperdrive" */
/** @import {CoreStoreOpts} from "corestore" */
/** @typedef {string|Buffer} NameOrKeyOrURL */
/** @typedef {{key?:Buffer|Uint8Array|null, name?:string}} ResolvedKeyOrName */
/**
 * @typedef {object} DNSResponse
 * @property {{name: string, data: string}} DNSResponse.Answer
 */
export const HYPER_PROTOCOL_SCHEME: "hyper://";
export const DEFAULT_CORE_OPTS: {};
export namespace DEFAULT_JOIN_OPTS {
    let server: boolean;
    let client: boolean;
}
export const DEFAULT_CORESTORE_OPTS: {};
export const DEFAULT_SWARM_OPTS: {};
export class SDK extends EventEmitter<any> {
    /**
     * @param {object} [options]
     * @param {typeof globalThis["fetch"]} [options.fetch]
     * @param {HyperSwarm} [options.swarm]
     * @param {CoreStore} [options.corestore]
     * @param {CoreOpts} [options.defaultCoreOpts]
     * @param {JoinOpts} [options.defaultJoinOpts]
     * @param {string} [options.dnsResolver]
     * @param {boolean} [options.autoJoin=true]
     * @param {boolean} [options.doReplicate=true]
     * @param {RocksDB} [options.dnsCache]
     */
    constructor({ swarm, corestore, dnsCache, fetch, defaultCoreOpts, defaultJoinOpts, dnsResolver, autoJoin, doReplicate }?: {
        fetch?: typeof globalThis.fetch | undefined;
        swarm?: HyperSwarm | undefined;
        corestore?: CoreStore | undefined;
        defaultCoreOpts?: CoreOpts | undefined;
        defaultJoinOpts?: JoinOpts | undefined;
        dnsResolver?: string | undefined;
        autoJoin?: boolean | undefined;
        doReplicate?: boolean | undefined;
        dnsCache?: RocksDB | undefined;
    });
    autoJoin: boolean;
    get swarm(): HyperSwarm;
    get corestore(): CoreStore;
    get publicKey(): any;
    get connections(): Connection[];
    get peers(): Map<string, import("hyperswarm").PeerInfo>;
    /**
     * @type {Hypercore[]}
     */
    get cores(): Hypercore[];
    /**
     * @type {Hyperdrive[]}
     */
    get drives(): Hyperdrive[];
    /** @type {Hyperbee[]} */
    get bees(): Hyperbee[];
    /**
     * Resolve DNS names to a hypercore key using the DNSLink spec
     * @param {string} hostname Hostname to resolve, e,g, `agregore.mauve.moe`
     * @returns {Promise<string>}
     */
    resolveDNSToKey(hostname: string): Promise<string>;
    /**
     * Resolves a string to be a key or opts and resolves DNS
     * Useful for hypercore opts or Hyperdrive
     * @param {NameOrKeyOrURL} nameOrKeyOrURL Name or key or URL to resolve
     * @returns {Promise<ResolvedKeyOrName>}
     */
    resolveNameOrKeyToOpts(nameOrKeyOrURL: NameOrKeyOrURL): Promise<ResolvedKeyOrName>;
    /**
     *
     * @param {NameOrKeyOrURL} nameOrKeyOrURL Name or key or hyper URL for the bee
     * @param {BeeOpts & CoreOpts & JoinOpts} opts Options for configuring Hyperbee
     * @returns {Promise<Hyperbee>}
     */
    getBee(nameOrKeyOrURL: NameOrKeyOrURL, opts?: BeeOpts & CoreOpts & JoinOpts): Promise<Hyperbee>;
    /**
     *
     * @param {NameOrKeyOrURL} nameOrKeyOrURL
     * @param {DriveOpts&JoinOpts} opts
     * @returns {Promise<Hyperdrive>}
     */
    getDrive(nameOrKeyOrURL: NameOrKeyOrURL, opts?: DriveOpts & JoinOpts): Promise<Hyperdrive>;
    /**
     * @template DataType
     * Get a HyperCore by its name or key or URL
     * @param {NameOrKeyOrURL} nameOrKeyOrURL
     * @param {CoreOpts&JoinOpts} [opts]
     * @returns {Promise<Hypercore<DataType>>}
     */
    get<DataType>(nameOrKeyOrURL: NameOrKeyOrURL, opts?: CoreOpts & JoinOpts): Promise<Hypercore<DataType>>;
    /**
     * Get a sub CoreStore for a given namespace. Use this to derive core names for a particular group
     * @param {string} namespace Namespace to store cores under
     * @returns {CoreStore}
     */
    namespace(namespace: string): CoreStore;
    /**
     * Derive a topic key (for hypercores) from a namespace.
     * @param {string} name Name of the namespace to derive
     * @returns {Buffer}
     */
    makeTopicKey(name: string): Buffer;
    /**
     * Start peer discovery on a core. Use this if you created a core on a namespaced CoreStore
     * @param {Hypercore} core
     * @param {JoinOpts} opts
     * @returns {Promise<void>}
     */
    joinCore(core: Hypercore, opts?: JoinOpts): Promise<void>;
    /**
     *
     * @param {string|Buffer} topic
     * @param {JoinOpts} opts
     * @returns {PeerDiscovery}
     */
    join(topic: string | Buffer, opts?: JoinOpts): PeerDiscovery;
    /**
     *
     * @param {string|Buffer} topic
     * @returns {Promise<void>}
     */
    leave(topic: string | Buffer): Promise<void>;
    /**
     * @param {Buffer} id
     */
    joinPeer(id: Buffer): void;
    /**
     * @param {Buffer} id
     */
    leavePeer(id: Buffer): void;
    ready(): Promise<void>;
    close(): Promise<void>;
    /**
     * Replicate a connection from hyperswarm manually
     * @param {Connection} connection
     */
    replicate(connection: Connection): void;
    #private;
}
export type NameOrKeyOrURL = string | Buffer;
export type ResolvedKeyOrName = {
    key?: Buffer | Uint8Array | null;
    name?: string;
};
export type DNSResponse = {
    Answer: {
        name: string;
        data: string;
    };
};
import type { CoreStoreOpts } from "corestore";
import type { SwarmOpts } from "hyperswarm";
import HyperSwarm from 'hyperswarm';
import CoreStore from 'corestore';
import RocksDB from 'rocksdb-native';
import type { CoreOpts } from "hypercore";
import type { JoinOpts } from "hyperswarm";
import { EventEmitter } from 'events';
import type { Connection } from "hyperswarm";
import Hypercore from 'hypercore';
import Hyperdrive from 'hyperdrive';
import Hyperbee from 'hyperbee';
import type { BeeOpts } from "hyperbee";
import type { DriveOpts } from "hyperdrive";
import type { PeerDiscovery } from "hyperswarm";
