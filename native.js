const SwarmNetworker = require('@corestore/networker')
const RAA = require('random-access-application')
const RAM = require('random-access-memory')
const HypercoreProtocol = require('hypercore-protocol')
const Corestore = require('corestore')
const SDK = require('./sdk')

const DEFAULT_SWARM_OPTS = {
  extensions: [],
  preferredPort: 42666
}
const DEFAULT_CORESTORE_OPTS = {
  sparse: true
}

module.exports = async function createSDK (opts) {
  return SDK({ ...opts, backend: nativeBackend })
}
module.exports.createBackend = nativeBackend

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
    close
  }

  async function deriveSecret (namespace, name) {
    return corestore.inner._deriveSecret(namespace, name)
  }

  function close (cb) {
    corestore.close(() => {
      swarm.close().then(cb, cb)
    })
  }
}
