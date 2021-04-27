const { spawn } = require('child_process')
const tmp = require('tmp-promise')
const dht = require('@hyperswarm/dht')
const HyperspaceServer = require('hyperspace/server')
const HyperswarmServer = require('hyperswarm-web/server')
const webnet = require('webnet')
const http = require('http')
const tapeRun = require('tape-run')
const path = require('path')
const { createWriteStream, createReadStream } = require('node:fs')
const { randomBytes } = require('hypercore-crypto')

main({
  build: !process.argv.includes('--skip-build'),
  spaces: !process.argv.includes('--skip-spaces'),
  swarm: !process.argv.includes('--skip-swarm'),
  tape: !process.argv.includes('--skip-tape')
})
  .catch(error => console.error(error))

async function main (opts) {
  const file = path.join(__dirname, '..', '..', 'test-bundle.js')
  console.log(`# bundle = ${path.relative(process.cwd(), file)}`)
  const closed = new Promise(resolve => {
    process.once('SIGINT', resolve)
    process.once('SIGTERM', resolve)
  })
  let spaces, swarm, build, tape
  try {
    // The number of spaces is equal to the number of spaces defined in the `../test.js` under `createSDKs(2)`
    if (opts.spaces) spaces = createManySpaces(2)
    else console.log('# [hyperspace] skip')
    if (opts.swarm) swarm = createHyperswarm()
    else console.log('# [hyperswarm] skip')
    if (opts.build) build = createBuild(file)
    else console.log('# [build] skip')
    await Promise.all([spaces, swarm, build && build.done].filter(Boolean))
    if (opts.tape) tape = createTape(file)
    else console.log('# [tape] skip; Open ./test.html in a browser to execute the test.')
    await Promise.race([
      tape && tape.done,
      closed
    ].filter(Boolean))
  } finally {
    await new Promise(resolve => setTimeout(resolve, 100))
    if (spaces) await (await spaces).cleanup()
    if (swarm) await (await swarm).close()
    if (build) await build.cancel()
    if (tape) await tape.close()
  }
  process.exit(tape ? await tape.done : 1)
}

function createBuild (file) {
  console.log('# [build] building test bundle')
  const build = spawn('npm', ['run', '--silent', 'build-test'], { stdio: 'pipe' })
  build.stderr.pipe(process.stderr, { end: false })
  const out = createWriteStream(file)
  build.stdout.pipe(out)
  return {
    done: new Promise((resolve, reject) => 
      out.once('error', reject)
         .once('close', resolve)
    ).then(
      () => console.log('# [build] complete'),
      err => {
        console.error('# [build] error:', err)
        return Promise.reject(err)
      }
    ),
    cancel () {
      if (build.exitCode === null) build.kill()
      if (!out.destroyed) out.destroy()
    }
  }
}

function createTape (file) {
  console.log('# [tape] running tests')
  const run = tapeRun()
  const read = createReadStream(file)
  read.pipe(run)
    .pipe(process.stdout, { end: false })

  const exitCode = new Promise((resolve) => {
    run.on('error', error => {
      console.log(`# [tape] error ${error}`)
      resolve(1)
    })
    run.once('results', results => {
      const exitCode = Number(!results.ok)
      console.log(`# [tape] exit-code: ${exitCode}`)
      closed = true
      resolve(exitCode)
    })
  })
  let close
  const done = Promise.race([
    new Promise(resolve => {
      close = () => {
        if (closed) return
        closed = true
        resolve(1)
        if (!read.destroyed) read.destroy()
        if (!run.destroyed) run.destroy()
      }
    }),
    (async () => {
      await new Promise(resolve => run.once('close', resolve))
      closed = true
      return await exitCode
    })()
  ])
  let closed = false
  return {
    close,
    done
  }
}

function createHyperswarm () {
  const port = 4977
  const server = http.createServer((_req, res) => res.end('hyperswarm-web'))
  const wsServer = new HyperswarmServer()
  wsServer.listenOnServer(server)
  let closed = false
  return new Promise((resolve, reject) => { 
    server.on('error', reject)
    server.listen(port, () => {
      server.off('error', reject)
      console.log(`# [hyperswarm] Listening on ws://localhost:${port}`)
      console.log(`# [hyperswarm] → Proxy available on ws://localhost:${port}/proxy`)
      console.log(`# [hyperswarm] → Signal available on ws://localhost:${port}/signal`)
      resolve({
        async close () {
          if (closed) return
          closed = true
          await new Promise(resolve => server.close(() => resolve()))
          await new Promise(resolve => wsServer.destroy(() => resolve()))
        }
      })
    })
  })
}

async function createOneSpace (opts = {}) {
  const tmpDir = opts.dir || await tmp.dir({ prefix: 'dat-sdk-hyperspace-' + randomBytes(6).toString('hex'), unsafeCleanup: true })
  const connections = new Set()
  const webnetServer = webnet.createServer((connection) => {
    connections.add(connection)
    connection.on('close', () => connections.delete(connection))
  })
  const server = new HyperspaceServer({
    ...opts,
    server: webnetServer,
    storage: tmpDir.path,
    network: {
      bootstrap: opts.bootstrap || false,
      preferredPort: 0
    },
    noMigrate: true
  })
  server.on('client-open', () => {
    console.log('# [hyperspace] client session opened')
  })
  server.on('client-close', () => {
    console.log('# [hyperspace] client session closed')
  })
  server.on('error', (error) => {
    console.log(`# [hyperspace] error ${error}`)
  })
  webnetServer.on('error', (error) => {
    console.log(`# [hyperspace] webnet error ${error}`)
  })
  await Promise.all([
    new Promise((resolve, reject) => {
      webnetServer.once('listening', () => {
        console.log(`# [hyperspace] Server listening on ws://localhost:${opts.port}`)
        resolve()
      })
      webnetServer.once('error', reject)
    }),
    server.ready()
  ])

  const cleanup = async () => {
    await Promise.all(Array.from(connections).map(async connection => {
      connection.on('error', () => {})
      const close = new Promise(resolve => connection.once('close', resolve))
      connection.destroy()
      await close
    }))
    await server.close()
    await new Promise(resolve => webnetServer.close(() => resolve())),
    await tmpDir.cleanup()
  }

  return { server, cleanup, dir: tmpDir }
}

async function createManySpaces (numDaemons, opts) {
  const cleanups = []
  const clients = []
  const servers = []
  const dirs = []

  const bootstrapper = dht({
    bootstrap: false
  })
  bootstrapper.listen()
  await new Promise(resolve => {
    return bootstrapper.once('listening', resolve)
  })
  const bootstrapPort = bootstrapper.address().port
  const bootstrapHost = `localhost:${bootstrapPort}`
  console.log(`# [hyperspace] Using dht bootstrap server listening at ${bootstrapHost}`)
  const bootstrapOpt = [bootstrapHost]

  for (let i = 0; i < numDaemons; i++) {
    const serverOpts = opts ? Array.isArray(opts) ? opts[i] : opts : null
    const { server, client, cleanup, dir } = await createOneSpace({
      ...serverOpts,
      bootstrap: bootstrapOpt,
      port: 9000 + i
    })
    cleanups.push(cleanup)
    servers.push(server)
    clients.push(client)
    dirs.push(dir)
  }

  return { clients, servers, cleanup, dirs, bootstrapOpt }

  async function cleanup (opts) {
    for (const cleanupInstance of cleanups) {
      await cleanupInstance(opts)
    }
    await bootstrapper.destroy()
  }
}
