const path = require('path')

// This is a dirty hack for browserify to work. 😅
if (!path.posix) path.posix = path

const SwarmNetworker = require('corestore-swarm-networking')
const datStorage = require('universal-dat-storage')
const DatEncoding = require('dat-encoding')
const crypto = require('hypercore-crypto')
const RAM = require('random-access-memory')

const datDNS = require('dat-dns')
const hyperdrive = require('hyperdrive')
const hypercore = require('hypercore')
const corestore = require('corestore')

const DEFAULT_STORAGE_OPTS = {
  persist: true
}
const DEFAULT_SWARM_OPTS = {
  extensions: []
}
const DEFAULT_DRIVE_OPTS = {
  sparse: true,
  persist: true
}
const DEFAULT_CORE_OPTS = {}
const DEFAULT_DNS_OPTS = {}
const DEFAULT_CORESTORE_OPTS = {}

module.exports = SDK

function SDK ({
  storageOpts,
  swarmOpts,
  driveOpts,
  coreOpts,
  dnsOpts,
  corestoreOpts
} = {}) {
  const finalDnsOpts = Object.assign({}, DEFAULT_DNS_OPTS, dnsOpts)
  const finalStorageOpts = Object.assign({}, DEFAULT_STORAGE_OPTS, storageOpts)
  const finalCorestoreOpts = Object.assign({}, DEFAULT_CORESTORE_OPTS, corestoreOpts)
  const finalSwarmOpts = Object.assign({}, DEFAULT_SWARM_OPTS, swarmOpts)
  const finalDriveOpts = Object.assign({}, DEFAULT_DRIVE_OPTS, driveOpts)

  const dns = datDNS(finalDnsOpts)

  let storage = RAM
  if(finalStorageOpts.persist) {
    storage = datStorage(finalStorageOpts)
  } else {
    driveOpts.persist = false
  }

  const store = corestore(storage.getCoreStore('cores'), finalCorestoreOpts)

  const swarm = new SwarmNetworker(store, finalSwarmOpts)

  let currentExtensions = finalSwarmOpts.extensions || []

  // Track list of hyperdrives
  const drives = new Map()
  const cores = new Map()

  swarm.listen()

  function addExtensions (extensions) {
    if (!extensions || !extensions.length) return
    const finalSet = new Set([...currentExtensions, ...extensions])

    currentExtensions = [...finalSet]

    // Modify all new extensions on the default core
    // TODO: Dynamic extension configuration
    if (store.defaultCore) store.defaultCore.extensions = currentExtensions
  }

  function destroy (cb) {
    for (let drive of drives.values()) {
      drive.close()
    }

    for (let core of cores.values()) {
      core.close()
    }

    swarm.close().then(cb, cb)
  }

  function resolveName (url, cb) {
    return dns.resolveName(url, cb)
  }

  function deleteStorage (key, cb) {
    cb(new Error('TODO: Cannot delete storage yet'))
  }

  // This is a gross hack that lets us use custom storage for cores
  // We need to add feeds to the store manually so that they will be replicated
  function addFeed (feed) {
    console.log('adding feed')
    store.emit('feed', feed)
    store.cores.set(DatEncoding.encode(feed.key), feed)
    store.cores.set(DatEncoding.encode(feed.discoveryKey), feed)

    for (let { stream, opts } of store.replicationStreams) {
      store._replicateCore(feed, stream, { ...opts })
    }
  }

  function Hyperdrive (location, opts) {
    opts = Object.assign({}, finalDriveOpts, opts)
    console.log('drive opts', opts)

    addExtensions(opts.extensions)

    opts.extensions = currentExtensions

    let key = null

    if (!location) {
      const { publicKey, secretKey } = crypto.keyPair()
      key = publicKey
      location = DatEncoding.encode(publicKey)
      opts.secretKey = secretKey
    }

    key = DatEncoding.decode(location)

    const stringKey = key.toString('hex')

    if (drives.has(stringKey)) return drives.get(stringKey)

    const { persist } = opts

    let driveStorage = store
    let shouldAddToStore = false
    if (!persist) {
      driveStorage = RAM
      shouldAddToStore = true
    } else if (opts.storage) {
      driveStorage = opts.storage(location)
      shouldAddToStore = true
    }

    const drive = hyperdrive(driveStorage, key, opts)

    drives.set(stringKey, drive)

    drive.ready(() => {
      if (shouldAddToStore) {
        addFeed(drive.metadata)
      }
      swarm.seed(drive.discoveryKey)
    })

    drive.once('close', () => {
      const discoveryKey = DatEncoding.encode(drive.discoveryKey)
      swarm.unseed(discoveryKey)
      drives.delete(stringKey)
    })

    return drive
  }

  function Hypercore (location, opts) {
    opts = Object.assign({}, DEFAULT_CORE_OPTS, coreOpts, opts)

    addExtensions(opts.extensions)

    let key = null

    if (!location) {
      const { publicKey, secretKey } = crypto.keyPair()
      key = publicKey
      location = DatEncoding.encode(publicKey)
      opts.secretKey = secretKey
    } else {
      key = DatEncoding.decode(location)
    }

    opts.key = key

    const stringKey = key.toString('hex')

    if (cores.has(stringKey)) return cores.get(stringKey)

    const { persist } = opts

    let core = null
    let shouldAddToStore = false

    if (persist) {
      core = store.get(opts)
    } else {
      core = hypercore(RAM, key, opts)
      shouldAddToStore = true
    }

    cores.set(stringKey, core)

    core.ready(() => {
      if (shouldAddToStore) {
        addFeed(core)
      }
      swarm.seed(core.discoveryKey)
    })

    core.once('close', () => {
      const discoveryKey = DatEncoding.encode(core.discoveryKey)
      swarm.unseed(discoveryKey)
      cores.delete(stringKey)
    })

    return core
  }

  return {
    Hyperdrive,
    Hypercore,
    resolveName,
    deleteStorage,
    destroy
  }
}
