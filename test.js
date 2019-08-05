const SDK = require('./')
const test = require('tape')

const isBrowser = process.title === 'browser'
const storageLocation = isBrowser ? '/' : require('tmp').dirSync({
  prefix: 'universal-dat-storage-'
}).name

const { Hyperdrive, Hypercore, resolveName, destroy } = SDK({
  storageOpts: {
    storageLocation
  }
})

const DATPROJECT_KEY = 'dat://60c525b5589a5099aa3610a8ee550dcd454c3e118f7ac93b7d41b6b850272330'
const TEST_TIMEOUT = 10 * 1000

test.onFinish(destroy)

test('Hyperdrive - load drive', (t) => {
  t.timeoutAfter(TEST_TIMEOUT)

  const drive = Hyperdrive(DATPROJECT_KEY)

  drive.readFile('/dat.json', 'utf8', (err, data) => {
    t.notOk(err, 'loaded file without error')

    t.end()
  })
})

test('Hyperdrive - create drive', (t) => {
  t.timeoutAfter(TEST_TIMEOUT)

  const drive = Hyperdrive()

  drive.writeFile('/example.txt', 'Hello World!', (err) => {
    t.notOk(err, 'Able to write to hyperdrive')

    t.end()
  })
})

test('Hyperdrive - get existing drive', (t) => {
  const drive = Hyperdrive()

  drive.ready(() => {
    const existing = Hyperdrive(drive.key)

    t.equal(existing, drive, 'Got existing drive by reference')

    t.end()
  })
})

test('Hyperdrive - new drive created after close', (t) => {
  const drive = Hyperdrive()

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

  resolveName('dat://dat.foundation', (err, resolved) => {
    t.notOk(err, 'Resolved successfully')

    const drive = Hyperdrive(resolved)

    drive.readFile('/dat.json', 'utf8', (err2) => {
      t.notOk(err2, 'loaded file without error')

      t.end()
    })
  })
})

test('Hypercore - create', (t) => {
  t.timeoutAfter(TEST_TIMEOUT)

  const core = Hypercore()

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
