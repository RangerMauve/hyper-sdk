const discovery = require('hyperdiscovery')
const datStorage = require('universal-dat-storage')
const DatEncoding = require('dat-encoding')
const crypto = require('hypercore-crypto')

const datDNS = require('dat-dns')
const hyperdrive = require('hyperdrive')
const hypercore = require('hypercore')

const DEFAULT_STORAGE_OPTS = {}
const DEFAULT_SWARM_OPTS = {
  extensions: []
}
const DEFAULT_DRIVE_OPTS = {
  sparse: true
}
const DEFAULT_CORE_OPTS = {}
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

    swarm.close(cb)
  }

  function resolveName (url, cb) {
    return dns.resolveName(url, cb)
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

    const drive = hyperdrive(storage.getDrive(location), key, opts)

    drives.set(stringKey, drive)

    drive.ready(() => {
      swarm.add(drive)
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

    const core = hypercore(storage.getCore(location, key, opts))

    cores.set(stringKey, core)

    core.ready(() => {
      swarm.add(core)
    })

    return core
  }

  return {
    Hyperdrive,
    Hypercore,
    resolveName,
    destroy
  }
}
