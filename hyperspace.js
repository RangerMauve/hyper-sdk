const HyperspaceClient = require('@hyperspace/client')

module.exports = async function hyperspaceBackend (opts) {
  let {
    corestore,
    hyperspaceClient,
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
    close
  }

  async function deriveSecret (namespace, name) {
    throw new Error('Deriving secrets is not supported')
  }

  function close (cb) {
    corestore.close(cb)
  }
}
