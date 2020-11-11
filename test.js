const SDK = require('./')
const dht = require('@hyperswarm/dht')
const test = require('tape')
const RAA = require('random-access-application')
const tmp = require('tmp')

const { createMany } = require('hyperspace/test/helpers/create')

const isBrowser = process.title === 'browser'

tmp.setGracefulCleanup()
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

async function createNative () {
  const { bootstrap, cleanup: cleanupDht } = await createDHT()

  const sdk1 = await SDK({
    storage: getNewStorage(),
    swarmOpts: { bootstrap }
  })
  const sdk2 = await SDK({
    storage: getNewStorage(),
    swarmOpts: { bootstrap }
  })

  return { sdk: [sdk1, sdk2], cleanup, bootstrap }

  function cleanup () {
    cleanupDht()
  }

  async function createDHT () {
    const bootstrapper = dht({
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
}

async function createHyperspace () {
  const { clients, cleanup: cleanupHyperspace } = await createMany(2)
  const sdk1 = await SDK({ hyperspaceClient: clients[0] })
  const sdk2 = await SDK({ hyperspaceClient: clients[1] })
  return { sdk: [sdk1, sdk2], cleanup }

  function cleanup () {
    cleanupHyperspace()
  }
}

function getNewStorage () {
  if (isBrowser) {
    // Get a random number, use it for random-access-application
    const name = Math.random().toString()
    return RAA(name)
  } else {
    return tmp.dirSync({
      prefix: 'dat-sdk-tests-'
    }).name
  }
}

async function run (createTestSDK, name) {
  const { sdk, cleanup } = await createTestSDK()
  const { Hyperdrive, Hypercore, resolveName, close } = sdk[0]
  const { Hyperdrive: Hyperdrive2, Hypercore: Hypercore2, close: close2 } = sdk[1]

  const TEST_TIMEOUT = 60 * 1000

  const EXAMPLE_DNS_URL = 'dat://dat.foundation'
  const EXAMPLE_DNS_RESOLUTION = '60c525b5589a5099aa3610a8ee550dcd454c3e118f7ac93b7d41b6b850272330'

  test.onFinish(() => {
    close(() => {
      close2(() => {
        cleanup()
      })
    })
  })

  test(name + ': Hyperdrive - create drive', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)

    const drive = Hyperdrive('Example drive 1')

    drive.writeFile('/example.txt', 'Hello World!', (err) => {
      t.error(err, 'Able to write to hyperdrive')

      t.end()
    })
  })

  test(name + ': Hyperdrive - get existing drive', (t) => {
    const drive = Hyperdrive('Example drive 2')

    drive.ready(() => {
      const existing = Hyperdrive(drive.key)

      t.equal(existing, drive, 'Got existing drive by reference')

      t.end()
    })
  })

  test(name + ': Hyperdrive - load drive over network', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)

    const EXAMPLE_DATA = 'Hello World!'

    const drive1 = Hyperdrive2('Example drive 3')

    drive1.writeFile('/index.html', EXAMPLE_DATA, (err) => {
      t.error(err, 'wrote to initial archive')
      const drive = Hyperdrive(drive1.key)
      t.deepEqual(drive1.key, drive.key, 'loaded correct archive')
      drive.once('peer-open', () => {
        t.pass('Got peer for drive')
        drive.readFile('/index.html', 'utf8', (err, data) => {
          t.error(err, 'loaded file without error')
          t.equal(data, EXAMPLE_DATA)

          t.end()
        })
      })
    })
  })

  test(name + ': Hyperdrive - replicate in-memory drive', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)

    const EXAMPLE_DATA = 'Hello World!'

    const drive1 = Hyperdrive2('Example drive 4', { persist: false })

    drive1.writeFile('/index.html', EXAMPLE_DATA, (err) => {
      t.error(err, 'wrote to initial archive')
      const drive = Hyperdrive(drive1.key, { persist: false })
      t.deepEqual(drive1.key, drive.key, 'loaded correct archive')

      drive.ready(() => {
        if (drive.peers.length) testFile()
        else drive.once('peer-open', testFile)
      })

      function testFile () {
        t.pass('got peer')
        drive.readFile('/index.html', 'utf8', (err, data) => {
          t.error(err, 'loaded file without error')
          t.equal(data, EXAMPLE_DATA)

          t.end()
        })
      }
    })
  })

  test(name + ': Hyperdrive - new drive created after close', (t) => {
    const drive = Hyperdrive('Example drive 5')

    drive.ready(() => {
      drive.close(() => {
        const existing = Hyperdrive(drive.key)

        t.notOk(existing === drive, 'Got new drive by reference')

        t.end()
      })
    })
  })

  test.skip(name + ': resolveName - resolve and load archive', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)

    resolveName(EXAMPLE_DNS_URL, (err, resolved) => {
      t.error(err, 'Resolved successfully')

      t.equal(resolved, EXAMPLE_DNS_RESOLUTION)
      t.end()
    })
  })

  test(name + ': Hypercore - create', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)

    const core = Hypercore('Example hypercore 1')

    core.append('Hello World', (err) => {
      t.error(err, 'able to write to hypercore')

      t.end()
    })
  })

  test(name + ': Hypercore - load from network', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)
    t.plan(3)

    const core1 = Hypercore('Example hypercore 2')

    core1.append('Hello World', () => {
      const core2 = Hypercore2(core1.key)

      core2.ready(() => {
        t.deepEqual(core2.key, core1.key, 'loaded key correctly')
      })

      core2.once('peer-open', () => {
        core2.get(0, (err, data) => {
          t.error(err, 'no error reading from core')
          t.ok(data, 'got data from replicated core')

          t.end()
        })
      })
    })
  })

  test(name + ': Hypercore - replicate in-memory cores', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)
    t.plan(3)

    const core1 = Hypercore('Example hypercore 3', { persist: false })

    core1.append('Hello World', () => {
      const core2 = Hypercore2(core1.key, { persist: false })

      t.deepEqual(core2.key, core1.key, 'loaded key correctly')

      core2.once('peer-open', () => {
        core2.get(0, (err, data) => {
          t.error(err, 'no error reading from core')
          t.ok(data, 'got data from replicated core')
          t.end()
        })
      })
    })
  })

  test(name + ': Hypercore - only close when all handles are closed', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)
    t.plan(5)

    const core1 = Hypercore('Example hypercore 4')
    const core2 = Hypercore('Example hypercore 4')

    core1.once('close', () => t.pass('close event emitted once'))

    t.ok(core1 === core2, 'Second handle is same instance')

    core1.append('Hello World', () => {
      core1.close(() => {
        t.pass('First core closed')
        core1.get(0, (err) => {
          t.error(err, 'Still able to read after close')
          core2.close(() => {
            t.pass('Second core closed')
          })
        })
      })
    })
  })
}
