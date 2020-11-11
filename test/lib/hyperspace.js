const SDK = require('../../hyperspace')

const isBrowser = process.title === 'browser'

module.exports = async function createHyperspace () {
  const cleanups = []
  const sdk = []
  if (!isBrowser) {
    const { createMany } = require('hyperspace/test/helpers/create')
    const { clients, cleanup: cleanupHyperspace } = await createMany(2)
    cleanups.push(cleanupHyperspace)
    sdk[0] = await SDK({
      hyperspaceOpts: { client: clients[0] }
    })
    sdk[1] = await SDK({
      hyperspaceOpts: { client: clients[1] }
    })
  } else {
    sdk[0] = await SDK({
      hyperspaceOpts: { port: 9000 }
    })
    sdk[1] = await SDK({
      hyperspaceOpts: { port: 9001 }
    })
  }

  return { sdk, cleanup }

  function cleanup () {
    for (const cleanup of cleanups) {
      cleanup()
    }
  }
}
