const path = require('path')

// This is a dirty hack for browserify to work. 😅
if (!path.posix) path.posix = path

const discovery = require('hyperdiscovery')
const datStorage = require('universal-dat-storage')
const DatEncoding = require('dat-encoding')
const crypto = require('hypercore-crypto')
const RAM = require('random-access-memory')
const fs = require('fs')

const datDNS = require('dat-dns')
const hyperdrive = require('hyperdrive')
const hypercore = require('hypercore')

const DEFAULT_STORAGE_OPTS = {}
const DEFAULT_SWARM_OPTS = {
  extensions: []
}
const DEFAULT_DRIVE_OPTS = {
  sparse: true,
  persist: true
}
const DEFAULT_CORE_OPTS = {
	sparse: true,
	persist: true
}
const DEFAULT_DNS_OPTS = {}

module.exports = SDK

function SDK ({ storageOpts, swarmOpts, driveOpts, coreOpts, dnsOpts } = {}) {
  const storage = datStorage(Object.assign({}, DEFAULT_STORAGE_OPTS, storageOpts))
  const swarm = discovery(Object.assign({}, DEFAULT_SWARM_OPTS, swarmOpts))
  const dns = datDNS(Object.assign({}, DEFAULT_DNS_OPTS, dnsOpts))

  // Track list of hyperdrives
  const drives = new Map()
  const cores = new Map()

  function addExtensions (extensions) {
    if (!extensions || !extensions.length) return
    // TODO: This has code smell
    const currentExtensions = swarm._opts.extensions || []
    const finalSet = new Set([...currentExtensions, ...extensions])

    swarm._opts.extensions = [...finalSet]
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
      swarm.add(drive)
    })

    drive.once('close', () => {
      const discoveryKey = DatEncoding.encode(drive.discoveryKey)
      swarm.leave(discoveryKey)
      swarm._replicatingFeeds.delete(discoveryKey)
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
      swarm.add(core)
    })

    core.once('close', () => {
      const discoveryKey = DatEncoding.encode(core.discoveryKey)
      swarm.leave(discoveryKey)
      swarm._replicatingFeeds.delete(discoveryKey)
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
