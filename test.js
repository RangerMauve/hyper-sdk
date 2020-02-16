const SDK = require('./')
const test = require('tape')
const RAA = require('random-access-application')

const isBrowser = process.title === 'browser'

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

run()

async function run () {
  const { Hyperdrive, Hypercore, resolveName, destroy } = await SDK({
    storage: getNewStorage()
  })
  const { Hyperdrive: Hyperdrive2, Hypercore: Hypercore2, destroy: destroy2 } = await SDK({
    storage: getNewStorage()
  })

  const EXAMPLE_KEY = 'dat://f1b83ec1836550a480bdd92ec3b34bf0bf7b00c2810e2c50c463305955ac751a'
  const TEST_TIMEOUT = 10 * 1000

  const EXAMPLE_DNS_URL = 'dat://dat.foundation'
  const EXAMPLE_DNS_RESOLUTION = '60c525b5589a5099aa3610a8ee550dcd454c3e118f7ac93b7d41b6b850272330'

  test.onFinish(() => {
    destroy(() => {
      destroy2()
    })
  })

  test('Hyperdrive - create drive', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)

    const drive = Hyperdrive('Example drive 1')

    drive.writeFile('/example.txt', 'Hello World!', (err) => {
      t.notOk(err, 'Able to write to hyperdrive')

      t.end()
    })
  })

  test('Hyperdrive - get existing drive', (t) => {
    const drive = Hyperdrive('Example drive 2')

    drive.ready(() => {
      const existing = Hyperdrive(drive.key)

      t.equal(existing, drive, 'Got existing drive by reference')

      t.end()
    })
  })

  test('Hyperdrive - load drive over network', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)

    const drive1 = Hyperdrive2('Example drive 3')

    drive1.ready(() => {
      drive1.writeFile('/index.html', 'Hello World!', () => {
        const drive = Hyperdrive(drive1.key)
        reallyReady(drive, () => {
          drive.readFile('/index.html', 'utf8', (err, data) => {
            t.notOk(err, 'loaded file without error')

            t.end()
          })
        })
      })
    })
  })

  test('Hyperdrive - new drive created after close', (t) => {
    const drive = Hyperdrive('Example drive 3')

    drive.ready(() => {
      drive.once('close', () => {
        const existing = Hyperdrive(drive.key)

        t.notEqual(existing, drive, 'Got new drive by reference')

        t.end()
      })
      drive.close()
    })
  })

  test('resolveName - resolve and load archive', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)

    resolveName(EXAMPLE_DNS_URL, (err, resolved) => {
      t.notOk(err, 'Resolved successfully')

      t.equal(resolved, EXAMPLE_DNS_RESOLUTION)
      t.end()
    })
  })

  test('Hypercore - create', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)

    const core = Hypercore('Example hypercore 1')

    core.append('Hello World', (err) => {
      t.notOk(err, 'able to write to hypercore')

      t.end()
    })
  })

  test('Hypercore - load', (t) => {
    t.timeoutAfter(TEST_TIMEOUT)

    const key = '60c525b5589a5099aa3610a8ee550dcd454c3e118f7ac93b7d41b6b850272330'

    const core = Hypercore(key)

    core.ready(() => {
      t.equal(core.key.toString('hex'), key, 'loaded key')

      t.end()
    })
  })
}

// This make sure you sync up with peers before trying to do anything with the archive
function reallyReady (archive, cb) {
  archive.ready(() => {
    if (archive.metadata.peers.length) {
      archive.metadata.update({ ifAvailable: true }, cb)
    } else {
      archive.metadata.once('peer-add', () => {
        archive.metadata.update({ ifAvailable: true }, cb)
      })
    }
  })
}
