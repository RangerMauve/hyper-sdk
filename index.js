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
const hyperdrive = require('hyperdrive')
const Corestore = require('corestore')
const hypercore = require('hypercore')
const makeHypercorePromise = require('@geut/hypercore-promise')
const makeHyperdrivePromise = require('@geut/hyperdrive-promise')

const HyperspaceClient = require('@hyperspace/client')

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
//
async function nativeBackend (opts) {
  let {
    storage,
    corestore,
    applicationName,
    persist,
    swarmOpts,
    corestoreOpts
  } = opts
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

  // The corestore needs to be opened before creating the swarm.
  await corestore.ready()

  // I think this is used to create a persisted identity?
  // Needs to be created before the swarm so that it can be passed in
  const noiseSeed = await deriveSecret(applicationName, 'replication-keypair')
  const keyPair = HypercoreProtocol.keyPair(noiseSeed)

  const swarm = new SwarmNetworker(corestore, Object.assign({ keyPair }, DEFAULT_SWARM_OPTS, swarmOpts))

  return {
    storage,
    corestore,
    swarm,
    deriveSecret,
    keyPair,
    makeHyperdrive,
    makeHypercore,
    close
  }

  async function deriveSecret (namespace, name) {
    return corestore.inner._deriveSecret(namespace, name)
  }

  function close (cb) {
    swarm.close().then(cb, cb)
  }

  function makeHyperdrive (key, opts) {
    const { persist } = opts

    let driveStorage = corestore
    if (!persist) {
      driveStorage = RAM
    } else if (opts.storage) {
      driveStorage = opts.storage(key)
    } else {
      driveStorage = corestore
    }

    const drive = hyperdrive(driveStorage, key, opts)

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

    return drive
  }

  function makeHypercore (name, key, opts) {
    const { persist } = opts
    let coreStorage
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
      core = hypercore(coreStorage, key, opts)

      trackMemoryCore(core)
    } else {
      if (key) {
        // If a dat key was provided, get it from the corestore
        core = corestore.get({ ...opts, key })
      } else {
        // If no dat key was provided, but a name was given, use it as a namespace
        core = corestore.namespace(name).default(opts)
      }
    }
    return core
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

async function hyperspaceBackend (opts) {
  let {
    corestore,
    hyperspaceClient,
    // persist,
    clientOpts
  } = opts

  if (!corestore) {
    if (!hyperspaceClient) {
      hyperspaceClient = new HyperspaceClient(clientOpts)
    }
    await hyperspaceClient.ready()
    corestore = hyperspaceClient.corestore()
  }

  await hyperspaceClient.network.ready()
  const swarm = hyperspaceClient.network
  const keyPair = hyperspaceClient.network.keyPair

  return {
    corestore,
    swarm,
    keyPair,
    deriveSecret,
    close,
    makeHyperdrive,
    makeHypercore
  }

  async function deriveSecret (namespace, name) {
    throw new Error('Deriving secrets is not supported')
  }

  function close (cb) {
    cb()
  }

  function makeHyperdrive (key, opts) {
    // TODO: Throw error if opts.persist === false?
    return hyperdrive(corestore, key, opts)
  }

  function makeHypercore (name, key, opts) {
    // TODO: Throw error if opts.persist === false?
    let core
    if (key) {
      // If a dat key was provided, get it from the corestore
      core = corestore.get({ ...opts, key })
    } else {
      // If no dat key was provided, but a name was given, use it as a namespace
      core = corestore.namespace(name).default(opts)
    }
    return core
  }
}

async function getBackend (opts) {
  let { backend, hyperspaceClient } = opts
  if (!backend && hyperspaceClient) backend = 'hyperspace'
  if (!backend) backend = 'native'

  let handlers
  if (backend === 'native') {
    handlers = await nativeBackend(opts)
  } else if (backend === 'hyperspace') {
    handlers = await hyperspaceBackend(opts)
  } else if (typeof backend === 'function') {
    handlers = await backend(opts)
  } else {
    throw new Error('Invalid backend')
  }
  return handlers
}

async function SDK (opts = {}) {
  if (!opts.applicationName) opts.applicationName = DEFAULT_APPLICATION_NAME
  if (opts.persist === undefined) opts.persist = true

  const {
    driveOpts,
    coreOpts,
    dnsOpts
  } = opts

  const dns = datDNS(Object.assign({}, DEFAULT_DNS_OPTS, dnsOpts))

  const handlers = await getBackend(opts)
  const {
    storage,
    corestore,
    swarm,
    deriveSecret,
    keyPair,
    makeHyperdrive,
    makeHypercore
  } = handlers

  await corestore.ready()

  const drives = new Map()
  const cores = new Map()

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

    handlers.close(cb)
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

    const drive = makeHyperdrive(key, opts)
    const wrappedDrive = makeHyperdrivePromise(drive)

    drive[HANDLE_COUNT] = 0

    drive[CLOSE_FN] = drive.close
    drive.close = function (fd, cb) {
      if (fd && cb) return this[CLOSE_FN](fd, cb)
      const hasHandles = wrappedDrive[HANDLE_COUNT]--
      if (hasHandles > 0) setTimeout(fd, 0)
      else setTimeout(() => this[CLOSE_FN](fd, cb), 0)
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

    opts = Object.assign({}, DEFAULT_CORE_OPTS, coreOpts, opts)

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

    const name = key ? null : nameOrKey

    const core = makeHypercore(name, key, opts)
    // Wrap with promises
    const wrappedCore = makeHypercorePromise(core)

    core[HANDLE_COUNT] = 0

    core.close = function (cb) {
      if (!cb) cb = function noop () {}
      const hasHandles = wrappedCore[HANDLE_COUNT]--
      if (hasHandles === 0) {
        setTimeout(() => {
          let promise = core._close(cb)
          if (promise && promise.then) promise.then(cb, cb)
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
}
