const path = require('path')

// This is a dirty hack for browserify to work. 😅
if (!path.posix) path.posix = path

const SwarmNetworker = require('corestore-swarm-networking')
const RAA = require('random-access-application')
const DatEncoding = require('dat-encoding')
const crypto = require('hypercore-crypto')
const RAM = require('random-access-memory')
const HypercoreProtocol = require('hypercore-protocol')

const datDNS = require('dat-dns')
const makeHyperdrive = require('hyperdrive')
const Corestore = require('corestore')
const makeHypercore = require('hypercore')
const makeHypercorePromise = require('@geut/hypercore-promise')
const makeHyperdrivePromise = require('@geut/hyperdrive-promise')

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
const DEFAULT_CORESTORE_OPTS = {
  sparse: true
}

const DEFAULT_APPLICATION_NAME = 'dat-sdk'

module.exports = SDK

// TODO: Set up Promise API based on Beaker https://github.com/beakerbrowser/beaker/blob/blue-hyperdrive10/app/bg/web-apis/fg/hyperdrive.js

async function SDK ({
  storage,
  corestore,
  applicationName = DEFAULT_APPLICATION_NAME,
  swarmOpts,
  driveOpts,
  coreOpts,
  dnsOpts,
  corestoreOpts
} = {}
) {
  // Derive storage if it isn't provided
  // Don't derive if corestore was provided
  if (!storage && !corestore) storage = RAA(applicationName)

  if (!corestore) {
    corestore = new Corestore(
      storage,
      Object.assign({}, DEFAULT_CORESTORE_OPTS, corestoreOpts)
    )
  }

  // Track list of hyperdrives
  const drives = new Map()
  const cores = new Map()

  await corestore.ready()

  // I think this is used to create a persisted identity?
  // Needs to be created before the swarm so that it can be passed in
  const noiseSeed = await deriveSecret(applicationName, 'replication-keypair')
  const keyPair = HypercoreProtocol.keyPair(noiseSeed)

  const swarm = new SwarmNetworker(corestore, Object.assign({ keyPair }, DEFAULT_SWARM_OPTS, swarmOpts))
  const dns = datDNS(Object.assign({}, DEFAULT_DNS_OPTS, dnsOpts))

  return {
    Hyperdrive,
    Hypercore,
    resolveName,
    getIdentity,
    deriveSecret,
    close,
    _storage: storage,
    _corestore: corestore,
    _swarm: swarm,
    _dns: dns
  }

  async function deriveSecret (namespace, name) {
    return corestore._deriveSecret(namespace, name)
  }

  async function getIdentity () {
    return keyPair
  }

  function close (cb) {
    for (const drive of drives.values()) {
      drive.close()
    }

    for (const core of cores.values()) {
      core.close()
    }

    swarm.close().then(cb, cb)
  }

  function resolveName (url, cb) {
    return dns.resolveName(url, cb)
  }

  function Hyperdrive (nameOrKey, opts) {
    if (!nameOrKey) throw new Error('Must give a name or key in the constructor')

    opts = Object.assign({}, DEFAULT_DRIVE_OPTS, driveOpts, opts)

    let key = null

    try {
      key = DatEncoding.decode(nameOrKey)
      // Normalize keys to be hex strings of the key instead of dat URLs
      nameOrKey = key.toString('hex')
    } catch (e) {
      // Probably isn't a `dat://` URL, so it must be a name
    }

    if (drives.has(nameOrKey)) return drives.get(nameOrKey)

    opts.namespace = nameOrKey

    const { persist } = opts

    let driveStorage = corestore
    if (!persist) {
      driveStorage = RAM
    } else if (opts.storage) {
      driveStorage = opts.storage(key)
    } else {
      driveStorage = corestore
    }

    const drive = makeHyperdrivePromise(makeHyperdrive(driveStorage, key, opts))

    drives.set(nameOrKey, drive)
    if (!key) {
      drive.ready(() => {
        const key = drive.key
        const stringKey = key.toString('hex')
        drives.set(stringKey, drive)
      })
    }

    drive.ready(() => {
      const {
        discoveryKey = drive.discoveryKey,
        lookup = true,
        announce = true
      } = opts
      // Don't advertise if we're not looking up or announcing
      if (!lookup && !announce) return
      swarm.join(discoveryKey, { lookup, announce })
    })

    drive.once('close', () => {
      const { discoveryKey = drive.discoveryKey } = opts
      swarm.leave(discoveryKey)

      const key = drive.key
      const stringKey = key.toString('hex')

      drives.delete(stringKey)
      drives.delete(nameOrKey)
    })

    return drive
  }

  function Hypercore (nameOrKey, opts) {
    if (!nameOrKey) throw new Error('Must give a name or key in the constructor')

    opts = Object.assign({}, DEFAULT_CORE_OPTS, driveOpts, opts)

    let key = null

    try {
      key = DatEncoding.decode(nameOrKey)
      // Normalize keys to be hex strings of the key instead of dat URLs
      nameOrKey = key.toString('hex')
    } catch (e) {
      // Probably isn't a `dat://` URL, so it must be a name
    }

    if (cores.has(nameOrKey)) return cores.get(nameOrKey)

    const { persist } = opts
    let coreStorage = null

    if (!persist) {
      coreStorage = RAM
    } else if (opts.storage) {
      coreStorage = opts.storage(key)
    }

    let core = null

    // If sotrage was passed in the opts, use it. Else use the corestore
    if (coreStorage) {
      // We only want to generate keys if we have a custom storage
      // Else the corestore does fancy key storage for us
      if (!key) {
        const { publicKey, secretKey } = crypto.keyPair()
        key = publicKey
        opts.secretKey = secretKey
      }
      core = makeHypercore(coreStorage, key, opts)
    } else {
      if (key) {
        // If a dat key was provided, get it from the corestore
        core = corestore.get({ ...opts, key })
      } else {
        // If no dat key was provided, but a name was given, use it as a namespace
        core = corestore.namespace(nameOrKey).default(opts)
      }
    }

    // Wrap with promises
    core = makeHypercorePromise(core)

    cores.set(nameOrKey, core)
    if (!key) {
      core.ready(() => {
        const key = core.key
        const stringKey = key.toString('hex')
        cores.set(stringKey, core)
      })
    }

    core.ready(() => {
      const {
        discoveryKey = core.discoveryKey,
        lookup = true,
        announce = true
      } = opts

      // Don't advertise if we're not looking up or announcing
      if (!lookup && !announce) return
      swarm.join(discoveryKey, { announce, lookup })
    })

    core.once('close', () => {
      const { discoveryKey = core.discoveryKey } = opts
      const key = core.key
      const stringKey = key.toString('hex')

      swarm.leave(discoveryKey)

      cores.delete(stringKey)
      cores.delete(nameOrKey)
    })

    return core
  }
}
