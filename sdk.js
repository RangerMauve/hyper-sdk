const path = require('path')

// This is a dirty hack for browserify to work. 😅
if (!path.posix) path.posix = path

const DatEncoding = require('dat-encoding')
const datDNS = require('dat-dns')
const hyperdrive = require('hyperdrive')
const makeHypercorePromise = require('@geut/hypercore-promise')
const makeHyperdrivePromise = require('@geut/hyperdrive-promise')

const DEFAULT_DRIVE_OPTS = {
  sparse: true,
  persist: true
}
const DEFAULT_CORE_OPTS = {
  sparse: true,
  persist: true
}
const DEFAULT_DNS_OPTS = {}
const DEFAULT_APPLICATION_NAME = 'dat-sdk'

const CLOSE_FN = Symbol('close')
const HANDLE_COUNT = Symbol('closeCount')

module.exports = SDK
module.exports.DEFAULT_APPLICATION_NAME = DEFAULT_APPLICATION_NAME

// TODO: Set up Promise API based on Beaker https://github.com/beakerbrowser/beaker/blob/blue-hyperdrive10/app/bg/web-apis/fg/hyperdrive.js

async function SDK (opts = {}) {
  if (!opts.backend) throw new Error('No backend was passed in')

  if (!opts.applicationName) {
    opts.applicationName = DEFAULT_APPLICATION_NAME
  }
  if (opts.persist === undefined) {
    opts.persist = true
  }

  const {
    backend,
    driveOpts,
    coreOpts,
    dnsOpts
  } = opts

  const dns = datDNS(Object.assign({}, DEFAULT_DNS_OPTS, dnsOpts))

  const handlers = await backend(opts)
  const {
    storage,
    corestore,
    swarm,
    deriveSecret,
    keyPair
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
    const process = _close()
    if (!cb) {
      return process
    }
    process.then(() => cb(), cb)
  }

  async function _close () {
    await Promise.all(
      []
        .concat(Array.from(drives.values()).map(drive => drive.close()))
        .concat(Array.from(cores.values()).map(core => core.close()))
    )
    if (handlers.close) {
      await new Promise(
        (resolve, reject) =>
          handlers.close(error => { error ? reject(error): resolve() })
      )
    }
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

    const { key, name, id } = resolveNameOrKey(nameOrKey)

    if (drives.has(id)) {
      const existing = drives.get(id)
      existing[HANDLE_COUNT]++
      return existing
    }

    if (name) opts.namespace = name

    const drive = hyperdrive(corestore, key, opts)
    const wrappedDrive = makeHyperdrivePromise(drive)

    drive[HANDLE_COUNT] = 0

    drive[CLOSE_FN] = drive.close
    drive.close = function (fd, cb) {
      if (fd && cb) return this[CLOSE_FN](fd, cb)
      const hasHandles = wrappedDrive[HANDLE_COUNT]--
      if (hasHandles > 0) setTimeout(fd, 0)
      else setTimeout(() => this[CLOSE_FN](fd, cb), 0)
    }

    drives.set(id, wrappedDrive)

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
      drives.delete(id)

      const { discoveryKey = drive.discoveryKey } = opts
      swarm.configure(discoveryKey, { announce: false, lookup: false })
    })

    return wrappedDrive
  }

  function Hypercore (nameOrKey, opts) {
    if (!nameOrKey) throw new Error('Must give a name or key in the constructor')

    opts = Object.assign({}, DEFAULT_CORE_OPTS, coreOpts, opts)

    const { key, name, id } = resolveNameOrKey(nameOrKey)

    if (cores.has(id)) {
      const existing = cores.get(id)
      existing[HANDLE_COUNT]++
      return existing
    }

    let core
    if (key) {
      // If a dat key was provided, get it from the corestore
      core = corestore.get({ ...opts, key })
    } else {
      // If no dat key was provided, but a name was given, use it as a namespace
      core = corestore.namespace(name).default(opts)
    }

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

    cores.set(id, wrappedCore)

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
      cores.delete(id)
    })

    return wrappedCore
  }

  function resolveNameOrKey (nameOrKey) {
    let key, name, id
    try {
      key = DatEncoding.decode(nameOrKey)
      id = key.toString('hex')
      // Normalize keys to be hex strings of the key instead of dat URLs
    } catch (e) {
      // Probably isn't a `dat://` URL, so it must be a name
      name = nameOrKey
      id = name
    }
    return { key, name, id }
  }
}
