const SDK = require('../..')

module.exports = async function createHyperspace () {
  const { createMany } = require('hyperspace/test/helpers/create')

  const { clients, cleanup: cleanupHyperspace } = await createMany(2)
  const sdk1 = await SDK({ hyperspaceClient: clients[0] })
  const sdk2 = await SDK({ hyperspaceClient: clients[1] })
  return { sdk: [sdk1, sdk2], cleanup }

  function cleanup () {
    cleanupHyperspace()
  }
}
