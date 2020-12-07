const test = require('tape')
const createNative = require('./lib/native')
const createHyperspace = require('./lib/hyperspace')
const createMixed = require('./lib/mixed')

runAll()

async function runAll () {
  await run(createNative, 'native')
  await run(createHyperspace, 'hyperspace')
  await run(createMixed, 'mixed')
}

async function run (createTestSDKs, name) {
  const { sdks, cleanup } = await createTestSDKs(2)
  const { Hyperdrive, Hypercore, resolveName, close } = sdks[0]
  const { Hyperdrive: Hyperdrive2, Hypercore: Hypercore2, close: close2 } = sdks[1]

  const TEST_TIMEOUT = 60 * 1000

  const EXAMPLE_DNS_URL = 'dat://dat.foundation'
  const EXAMPLE_DNS_RESOLUTION = '60c525b5589a5099aa3610a8ee550dcd454c3e118f7ac93b7d41b6b850272330'

  test.onFinish(() => {
    close(() => {
      close2(() => {
        setTimeout(cleanup, 100)
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

  test(name + ': resolveName - resolve and load archive', (t) => {
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
