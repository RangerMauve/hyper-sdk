const path = require('path')

// This is a dirty hack for browserify to work. 😅
if (!path.posix) path.posix = path

const SwarmNetworker = require('@corestore/networker')
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
  extensions: [],
  preferredPort: 42666
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

const CLOSE_FN = Symbol('close')
const HANDLE_COUNT = Symbol('closeCount')

module.exports = SDK

// TODO: Set up Promise API based on Beaker https://github.com/beakerbrowser/beaker/blob/blue-hyperdrive10/app/bg/web-apis/fg/hyperdrive.js

async function SDK ({
  storage,
  corestore,
  applicationName = DEFAULT_APPLICATION_NAME,
  persist = true,
  swarmOpts,
  driveOpts,
  coreOpts,
  dnsOpts,
  corestoreOpts
} = {}
) {
  // Derive storage if it isn't provided
  // Don't derive if corestore was provided
  if (!storage && !corestore) {
    if (persist !== false) {
      storage = RAA(applicationName)
    } else {
      // Nothing should be persisted. 🤷
      storage = RAM
    }
  }

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
    registerExtension,
    close,
    get keyPair () { return keyPair },
    _storage: storage,
    _corestore: corestore,
    _swarm: swarm,
    _dns: dns
  }

  async function deriveSecret (namespace, name) {
    return corestore.inner._deriveSecret(namespace, name)
  }

  function getIdentity () {
    console.warn('getIdentity is being deprecated and will be removed in version 3.x.x, please use sdk.keyPair instead')
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

  function registerExtension (name, handlers) {
    return swarm.registerExtension(name, handlers)
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

    if (drives.has(nameOrKey)) {
      const existing = drives.get(nameOrKey)
      existing[HANDLE_COUNT]++
      return existing
    }

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

    const drive = makeHyperdrive(driveStorage, key, opts)
    const wrappedDrive = makeHyperdrivePromise(drive)

    drive[HANDLE_COUNT] = 0

    drive[CLOSE_FN] = drive.close
    drive.close = function (fd, cb) {
      if (fd && cb) return this[CLOSE_FN](fd, cb)
      const hasHandles = wrappedDrive[HANDLE_COUNT]--
      if (hasHandles > 0) setTimeout(fd, 0)
      else setTimeout(() => this[CLOSE_FN](fd, cb), 0)
    }

    if (driveStorage !== corestore) {
      drive.ready(() => {
        for (const core of drive.corestore.store.list().values()) {
          trackMemoryCore(core)
        }
        drive.corestore.store.on('feed', (core) => {
          trackMemoryCore(core)
        })
      })
    }

    drives.set(nameOrKey, wrappedDrive)
    if (!key) {
      drive.ready(() => {
        const key = drive.key
        const stringKey = key.toString('hex')
        drives.set(stringKey, wrappedDrive)
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
      swarm.configure(discoveryKey, { lookup, announce })
    })

    drive.once('close', () => {
      const key = drive.key
      const stringKey = key.toString('hex')

      drives.delete(stringKey)
      drives.delete(nameOrKey)

      const { discoveryKey = drive.discoveryKey } = opts
      swarm.configure(discoveryKey, { announce: false, lookup: false })
    })

    return wrappedDrive
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

    if (cores.has(nameOrKey)) {
      const existing = cores.get(nameOrKey)
      existing[HANDLE_COUNT]++
      return existing
    }
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

      trackMemoryCore(core)
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
    const wrappedCore = makeHypercorePromise(core)

    core[HANDLE_COUNT] = 0

    core.close = function (cb) {
      const hasHandles = wrappedCore[HANDLE_COUNT]--
      if (hasHandles <= 0) {
        setTimeout(() => {
          core._close(cb || function noop () {})
        }, 0)
      } else if (cb) setTimeout(cb, 0)
    }

    cores.set(nameOrKey, wrappedCore)

    if (!key) {
      core.ready(() => {
        const key = core.key
        const stringKey = key.toString('hex')
        cores.set(stringKey, wrappedCore)
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
      swarm.configure(discoveryKey, { announce, lookup })
    })

    core.once('close', () => {
      const { discoveryKey = core.discoveryKey } = opts
      const key = core.key
      const stringKey = key.toString('hex')

      swarm.configure(discoveryKey, { announce: false, lookup: false })

      cores.delete(stringKey)
      cores.delete(nameOrKey)
    })

    return wrappedCore
  }

  function trackMemoryCore (core) {
    core.ready(() => {
      cacheCore(core)
      corestore.inner._injectIntoReplicationStreams(core)
      corestore.inner.emit('feed', core)
    })

    core.once('close', () => {
      uncacheCore(core)
    })
  }

  function cacheCore (core) {
    corestore.inner.cache.set(core.discoveryKey.toString('hex'), core)
  }

  function uncacheCore (core) {
    corestore.inner.cache.delete(core.discoveryKey.toString('hex'))
  }
}
