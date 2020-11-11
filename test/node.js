const run = require('./tests')
const createNative = require('./lib/native')
const createHyperspace = require('./lib/hyperspace')

runAll()

async function runAll () {
  await run(createNative, 'native')
  await run(createHyperspace, 'hyperspace')
  await run(createMixed, 'mixed')
}

async function createMixed () {
  const native = await createNative()
  const hyperspace = await createHyperspace()
  const sdk1 = hyperspace.sdk[0]
  const sdk2 = native.sdk[0]
  return { sdk: [sdk1, sdk2], cleanup }
  function cleanup () {
    native.cleanup()
    hyperspace.cleanup()
  }
}
