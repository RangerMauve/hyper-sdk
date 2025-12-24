import HyperSwarm from 'hyperswarm'
import CoreStore from 'corestore'
import Hypercore from 'hypercore'
import Hyperdrive from 'hyperdrive'
import Hyperbee from 'hyperbee'
import crypto from 'hypercore-crypto'
import z32 from 'z32'
import b4a from 'b4a'
import { EventEmitter } from 'events'
import { join } from 'path'
import RocksDB from 'rocksdb-native'

// TODO: Base36 encoding/decoding for URLs instead of hex

export const HYPER_PROTOCOL_SCHEME = 'hyper://'
export const DEFAULT_CORE_OPTS = {}
export const DEFAULT_JOIN_OPTS = {
  server: true,
  client: true
}
export const DEFAULT_CORESTORE_OPTS = {}
export const DEFAULT_SWARM_OPTS = {}

// Monkey-patching with first class URL support
Object.defineProperty(Hypercore.prototype, 'url', {
  get: function () {
    return `${HYPER_PROTOCOL_SCHEME}${this.id}/`
  }
})
Object.defineProperty(Hyperdrive.prototype, 'url', {
  get: function () {
    return `${HYPER_PROTOCOL_SCHEME}${this.core.id}/`
  }
})
Object.defineProperty(Hyperbee.prototype, 'url', {
  get: function () {
    return `${HYPER_PROTOCOL_SCHEME}${this.feed.id}/`
  }
})

const DEFAULT_DNS_RESOLVER = 'https://mozilla.cloudflare-dns.com/dns-query'

const DNSLINK_PREFIX = 'dnslink=/hyper/'

export class SDK extends EventEmitter {
  #fetch
  #dnsCache
  #dnsMemoryCache
  #defaultCoreOpts
  #defaultJoinOpts
  #dnsResolver
  #swarm
  #corestore
  #coreCache
  #beeCache
  #driveCache

  constructor ({
    swarm = throwMissing('swarm'),
    corestore = throwMissing('corestore'),
    dnsCache = throwMissing('dnsCache'),
    fetch = globalThis.fetch,
    defaultCoreOpts = DEFAULT_CORE_OPTS,
    defaultJoinOpts = DEFAULT_JOIN_OPTS,
    dnsResolver = DEFAULT_DNS_RESOLVER,
    autoJoin = true,
    doReplicate = true
  } = {}) {
    super()
    this.#swarm = swarm
    this.#corestore = corestore
    this.#dnsCache = dnsCache
    this.#fetch = fetch

    // These probably shouldn't be accessed
    this.#dnsMemoryCache = new Map()
    this.#coreCache = new Map()
    this.#beeCache = new Map()
    this.#driveCache = new Map()

    this.#defaultCoreOpts = defaultCoreOpts
    this.#defaultJoinOpts = defaultJoinOpts
    this.#dnsResolver = dnsResolver

    this.autoJoin = autoJoin

    if (doReplicate) {
      swarm.on('connection', (connection, peerInfo) => {
        this.emit('peer-add', peerInfo)
        connection.once('close', () => this.emit('peer-remove', peerInfo))
        this.replicate(connection)
      })
    }
  }

  get swarm () {
    return this.#swarm
  }

  get corestore () {
    return this.#corestore
  }

  get publicKey () {
    return this.swarm.keyPair.publicKey
  }

  get connections () {
    return this.swarm.connections
  }

  get peers () {
    return this.swarm.peers
  }

  get cores () {
    return [...this.#coreCache.values()]
  }

  async resolveDNSToKey (hostname) {
    // TODO: Check for TTL?
    if (this.#dnsMemoryCache.has(hostname)) {
      return this.#dnsMemoryCache.get(hostname)
    }

    const fetch = this.#fetch

    const subdomained = `_dnslink.${hostname}`

    const url = `${this.#dnsResolver}?name=${subdomained}&type=TXT`

    let answers = null
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/dns-json' }
      })

      if (!response.ok) {
        throw new Error(
          `Unable to resolve DoH for ${hostname} ${await response.text()}`
        )
      }

      const dnsResults = await response.json()
      answers = dnsResults.Answer
      await this.#dnsCache.put(hostname, JSON.stringify(dnsResults))
    } catch (e) {
      const cached = await this.#dnsCache.get(hostname)
      if (cached) {
        answers = JSON.parse(cached).Answer
      }
    }

    for (let { name, data } of answers) {
      if (name !== subdomained || !data) {
        continue
      }
      if (data.startsWith('"')) {
        data = data.slice(1, -1)
      }
      if (!data.startsWith(DNSLINK_PREFIX)) {
        continue
      }
      const key = data.split('/')[2]
      this.#dnsMemoryCache.set(hostname, key)
      return key
    }

    throw new Error(`DNS-Link Record not found for TXT ${subdomained}`)
  }

  // Resolves a string to be a key or opts and resolves DNS
  // Useful for hypercore opts or Hyperdrive
  async resolveNameOrKeyToOpts (nameOrKeyOrURL) {
    // If a URL, use the hostname as either a key or a DNS to resolve
    // If not a URL, try to decode to a key
    // if not a key, use as name to generate a hypercore
    // Else it's an errorW

    const isKeyString = typeof nameOrKeyOrURL === 'string'
    if (!isKeyString) {
      // If a 32 byte buffer, use it as the key
      if (nameOrKeyOrURL && nameOrKeyOrURL.length === 32) {
        return { key: nameOrKeyOrURL }
      } else {
        throw new Error(
          'Must specify a name, url, or a 32 byte buffer with a key'
        )
      }
    }

    if (nameOrKeyOrURL.startsWith(HYPER_PROTOCOL_SCHEME)) {
      const url = new URL(nameOrKeyOrURL)
      // probably a domain
      if (url.hostname.includes('.')) {
        const key = await this.resolveDNSToKey(url.hostname)

        return { key: stringToKey(key) }
      } else {
        // Try to parse the hostname to a key
        const key = stringToKey(url.hostname)
        if (!key) {
          // If not a key or a domain, throw an error
          throw new Error(
            'URLs must have either an encoded key or a valid DNSlink domain'
          )
        }
        return { key }
      }
    } else {
      const parsed = stringToKey(nameOrKeyOrURL)
      if (parsed) {
        return { key: parsed }
      } else {
        return { name: nameOrKeyOrURL }
      }
    }
  }

  async getBee (nameOrKeyOrURL, opts = {}) {
    const core = await this.get(nameOrKeyOrURL, opts)

    if (this.#beeCache.has(core.url)) {
      return this.#beeCache.get(core.url)
    }

    const bee = new Hyperbee(core, opts)

    core.once('close', () => {
      this.#beeCache.delete(core.url)
    })

    this.#beeCache.set(core.url, bee)

    await bee.ready()

    return bee
  }

  async getDrive (nameOrKeyOrURL, opts = {}) {
    const coreOpts = {
      ...this.#defaultCoreOpts,
      autoJoin: this.autoJoin,
      ...opts
    }

    const resolvedOpts = await this.resolveNameOrKeyToOpts(nameOrKeyOrURL)

    const { key, name } = resolvedOpts
    let stringKey = key && key.toString('hex')

    if (this.#driveCache.has(name)) {
      return this.#driveCache.get(name)
    } else if (this.#driveCache.has(stringKey)) {
      return this.#driveCache.get(stringKey)
    }

    Object.assign(coreOpts, resolvedOpts)

    let corestore = this.corestore

    if (resolvedOpts.key) {
      corestore = this.namespace(stringKey)
    } else if (resolvedOpts.name) {
      corestore = this.namespace(name)
    } else {
      throw new Error('Unable to parse')
    }

    const drive = new Hyperdrive(corestore, key || null)

    await drive.ready()

    const core = drive.core
    stringKey = core.key.toString('hex')

    drive.once('close', () => {
      this.#driveCache.delete(stringKey)
      this.#driveCache.delete(name)
    })

    this.#driveCache.set(stringKey, drive)
    if (name) this.#driveCache.set(name, drive)

    if (coreOpts.autoJoin && !core.discovery) {
      await this.joinCore(core, opts)
    }

    return drive
  }

  async get (nameOrKeyOrURL, opts = {}) {
    const coreOpts = {
      ...this.#defaultCoreOpts,
      autoJoin: this.autoJoin,
      ...opts
    }

    const resolvedOpts = await this.resolveNameOrKeyToOpts(nameOrKeyOrURL)

    const { key, name } = resolvedOpts
    let stringKey = key && key.toString('hex')

    if (this.#coreCache.has(name)) {
      return this.#coreCache.get(name)
    } else if (this.#coreCache.has(stringKey)) {
      return this.#coreCache.get(stringKey)
    }

    Object.assign(coreOpts, resolvedOpts)

    // There shouldn't be a way to pass null for the key
    const core = this.corestore.get(coreOpts)

    // Await for core to be ready
    await core.ready()

    core.once('close', () => {
      this.#coreCache.delete(stringKey)
      this.#coreCache.delete(name)
    })

    stringKey = core.key.toString('hex')

    this.#coreCache.set(stringKey, core)
    if (name) this.#coreCache.set(name, core)

    if (coreOpts.autoJoin && !core.discovery) {
      await this.joinCore(core, opts)
    }

    return core
  }

  // Returns a corestore for a namespace
  namespace (namespace) {
    return this.corestore.namespace(namespace)
  }

  makeTopicKey (name) {
    const [key] = crypto.namespace(name, 1)
    return key
  }

  async joinCore (core, opts = {}) {
    if (core.discovery) return
    const discovery = this.join(core.discoveryKey, opts)
    core.discovery = discovery

    // If we're the owner, then we wait until is fully announced
    if (core.writable) {
      await discovery.flushed()
    }

    // Await for initial peer for new readable cores
    if (!core.writable && !core.length) {
      const done = core.findingPeers()
      this.swarm.flush().then(done)
      await core.update()
    }

    core.once('close', () => {
      discovery.destroy()
    })
  }

  join (topic, opts = {}) {
    if (typeof topic === 'string') {
      return this.join(this.makeTopicKey(topic), opts)
    }
    const joinOpts = { ...this.defaultJoinOpts, ...opts }
    return this.swarm.join(topic, joinOpts)
  }

  leave (topic) {
    if (typeof topic === 'string') {
      return this.leave(this.makeTopicKey(topic))
    }
    return this.swarm.leave(topic)
  }

  joinPeer (id) {
    return this.swarm.joinPeer(id)
  }

  leavePeer (id) {
    return this.swarm.leavePeer(id)
  }

  async ready () {
    // Wait for the network to be configured?
    await this.corestore.ready()
    await this.swarm.listen()
  }

  async close () {
    await this.#dnsCache.flush()
    // Close corestore, close hyperswarm
    await Promise.all([
      this.corestore.close(),
      this.swarm.destroy(),
      this.#dnsCache.close()
    ])
  }

  replicate (connection) {
    this.corestore.replicate(connection)
  }
}

export async function create ({
  storage,
  corestoreOpts = DEFAULT_CORESTORE_OPTS,
  swarmOpts = DEFAULT_SWARM_OPTS,
  fetch = globalThis.fetch,
  ...opts
} = {}) {
  // TODO: Account for "random-access-application" style storage
  if (!storage) {
    throw new Error('Storage parameter is required to be a valid file path')
  }
  const corestore =
    opts.corestore || new CoreStore(storage, { ...corestoreOpts })
  const dnsCache = opts.dnsCache || new RocksDB(join(storage, 'dnsCache'))

  const networkKeypair = await corestore.createKeyPair('noise')

  const swarm =
    opts.swarm ||
    new HyperSwarm({
      keyPair: networkKeypair,
      ...swarmOpts
    })

  const sdk = new SDK({
    ...opts,
    fetch: fetch || (await import('bare-fetch')).default,
    corestore,
    swarm,
    dnsCache
  })

  await sdk.ready()

  return sdk
}

function stringToKey (string) {
  if (string.length === 52) {
    try {
      return z32.decode(string)
    } catch {
      // Not formatted properly, probs a name?
    }
  } else if (string.length === 64) {
    // Parse as hex key
    try {
      return b4a.from(string, 'hex')
    } catch {
      // Not formatted properly, probs a name?
    }
  }
  return null
}

function throwMissing (name) {
  throw new TypeError(`Missing parameter ${name}`)
}
