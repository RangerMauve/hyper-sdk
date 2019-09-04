const path = require('path')

// This is a dirty hack for browserify to work. 😅
if (!path.posix) path.posix = path

const SwarmNetworker = require('corestore-swarm-networking')
const datStorage = require('universal-dat-storage')
const DatEncoding = require('dat-encoding')
const crypto = require('hypercore-crypto')
const RAM = require('random-access-memory')
const fs = require('fs')

const datDNS = require('dat-dns')
const hyperdrive = require('hyperdrive')
const corestore = require('corestore')

const DEFAULT_STORAGE_OPTS = {}
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
  corestoreOpts,
} = {}) {
  const finalDnsOpts = Object.assign({}, DEFAULT_DNS_OPTS, dnsOpts)
  const dns = datDNS(finalDnsOpts)

  const finalStorageOpts = Object.assign({}, DEFAULT_STORAGE_OPTS, storageOpts)
  const storage = datStorage(finalStorageOpts)

  const finalCorestoreOpts = Object.assign({}, DEFAULT_CORE_OPTS, corestoreOpts)
  const store = corestore(storage.getCoreStore('cores'), finalCorestoreOpts)

  const finalSwarmOpts = Object.assign({}, DEFAULT_SWARM_OPTS, swarmOpts)
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
    storage.delete(key, cb)
  }

  function Hyperdrive (location, opts) {
    opts = Object.assign({}, DEFAULT_DRIVE_OPTS, driveOpts, opts)

    addExtensions(opts.extensions)

    opts.extensions = currentExtensions

    let key = null

    if (!location) {
      const { publicKey, secretKey } = crypto.keyPair()
      key = publicKey
      location = DatEncoding.encode(publicKey)
      opts.secretKey = secretKey
    }

    try {
      key = DatEncoding.decode(location)
    } catch (e) {
      // Location must be relative path
    }

    const stringKey = location.toString('hex')

    if (drives.has(stringKey)) return drives.get(stringKey)

    const { persist } = opts

    let driveStorage = null
    try {
      if (!persist) {
        driveStorage = RAM
      } else if (opts.storage) {
        driveStorage = opts.storage(location)
      } else {
        driveStorage = storage.getDrive(location)
      }
    } catch (e) {
      if (e.message !== 'Unable to create storage') throw e

      // If the folder isn't a dat archive. Turn it into one.
      const { publicKey, secretKey } = crypto.keyPair()
      fs.writeFileSync(path.join(location, '.dat'), publicKey)
      key = publicKey
      location = DatEncoding.encode(publicKey)
      opts.secretKey = secretKey

      if (opts.storage) {
        driveStorage = opts.storage(location)
      } else {
        driveStorage = storage.getDrive(location)
      }
    }

    const drive = hyperdrive(driveStorage, key, opts)

    drives.set(stringKey, drive)

    drive.ready(() => {
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
    }

    try {
      key = DatEncoding.decode(location)
    } catch (e) {
      // Location must be relative path
    }

    const stringKey = location.toString('hex')

    if (cores.has(stringKey)) return cores.get(stringKey)

    const { persist } = opts

    const coreStorage = persist ? storage.getCore(location) : RAM

    const core = hypercore(coreStorage, key, opts)

    cores.set(stringKey, core)

    core.ready(() => {
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
