const HyperspaceClient = require('@hyperspace/client')
const { connect } = require('webnet')
const SDK = require('./sdk')

const isBrowser = process.title === 'browser'

module.exports = async function createSDK (opts) {
  return SDK({ ...opts, backend: hyperspaceBackend })
}
module.exports.createBackend = hyperspaceBackend

async function hyperspaceBackend (opts) {
  let {
    corestore,
    hyperspaceOpts = {}
  } = opts

  let hyperspaceClient
  if (!corestore) {
    let { client, protocol, port, host } = hyperspaceOpts
    if (client) {
      hyperspaceClient = client
    } else {
      if (!protocol) {
        protocol = isBrowser ? 'ws' : 'uds'
      }
      let clientOpts
      if (protocol === 'ws') {
        port = port || 9000
        clientOpts = connect(port, host)
      } else if (protocol === 'uds') {
        clientOpts = { host, port }
      }
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
    close
  }

  async function deriveSecret (namespace, name) {
    throw new Error('Deriving secrets is not supported')
  }

  function close (cb) {
    corestore.close(cb)
  }
}
