const SDK = require('../..')
const RAA = require('random-access-application')

const isBrowser = process.title === 'browser'

module.exports = async function createNative () {
  let swarmOpts, localDht
  if (!isBrowser) {
    localDht = await createDHT()
    swarmOpts = { bootstrap: localDht.bootstrap }
  }

  const sdk1 = await SDK({
    storage: getNewStorage(),
    swarmOpts
  })
  const sdk2 = await SDK({
    storage: getNewStorage(),
    swarmOpts
  })

  return { sdk: [sdk1, sdk2], cleanup }

  function cleanup () {
    if (localDht) localDht.cleanup()
  }
}

function getNewStorage () {
  if (isBrowser) {
    // Get a random number, use it for random-access-application
    const name = Math.random().toString()
    return RAA(name)
  } else {
    return require('tmp').dirSync({
      prefix: 'dat-sdk-tests-'
    }).name
  }
}

async function createDHT () {
  const bootstrapper = require('@hyperswarm/dht')({
    bootstrap: false
  })
  bootstrapper.listen()
  await new Promise(resolve => {
    return bootstrapper.once('listening', resolve)
  })
  const bootstrapPort = bootstrapper.address().port
  const bootstrapOpt = [`localhost:${bootstrapPort}}`]
  return { bootstrap: bootstrapOpt, cleanup }

  function cleanup () {
    bootstrapper.destroy()
  }
}
