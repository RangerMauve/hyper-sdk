const SDK = require('../..')
const RAA = require('random-access-application')
const { isBrowser } = require('./env')

module.exports = async function createNative (n) {
  let swarmOpts, localDht
  if (!isBrowser) {
    localDht = await createDHT()
    swarmOpts = { bootstrap: localDht.bootstrap }
  }
  const sdks = []
  while (--n >= 0) {
    const sdk = await SDK({
      storage: await getNewStorage(),
      swarmOpts
    })
    sdks.push(sdk)
  }

  return { sdks, cleanup }

  function cleanup () {
    console.log('# [test/native] cleanup start')
    if (localDht) localDht.cleanup()
    console.log('# [test/native] cleanup end')
  }
}

async function getNewStorage () {
  if (isBrowser) {
    // Get a random number, use it for random-access-application
    const name = Math.random().toString()
    return RAA(name)
  } else {
    const tmp = require('tmp-promise')
    const dir = await tmp.dir({
      prefix: 'dat-sdk-tests-'
    })
    return dir.path
  }
}

async function createDHT () {
  const bootstrapper = require('@hyperswarm/dht')({
    bootstrap: false
  })
  const closed = new Promise(resolve => bootstrapper.once('closed', resolve))
  bootstrapper.listen()
  await new Promise(resolve => {
    return bootstrapper.once('listening', resolve)
  })
  const bootstrapPort = bootstrapper.address().port
  const bootstrapOpt = [`localhost:${bootstrapPort}}`]
  return { bootstrap: bootstrapOpt, cleanup }

  async function cleanup () {
    bootstrapper.destroy()
    await closed
  }
}
