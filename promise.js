const path = require('path')
const pda = require('pauls-dat-api')
const parseURL = require('url-parse')
const concat = require('concat-stream')
const EventTarget = require('dom-event-target')
const {
  DAT_MANIFEST_FILENAME,
  DAT_VALID_PATH_REGEX
} = require('node-dat-archive/lib/const')
const {
  ArchiveNotWritableError,
  ProtectedFileNotWritableError,
  InvalidPathError,
  TimeoutError
} = require('beaker-error-constants')
const hexTo32 = require('hex-to-32')
const getLocalstorage = require('./localstorage')

const prompt = require('universal-prompt')

const SDKcb = require('./')

// Gateways are hella slow so we'll have a crazy long timeout
const API_TIMEOUT = 15 * 1000

// How long to wait to get peers / sync with them
const READY_DELAY = 3000

const BASE_32_KEY_LENGTH = 52

const DAT_KEY_URL_REGEX = /^dat:\/\/[\dabcdef]{64}\/?$/i

module.exports = function SDK (opts) {
  const { Hyperdrive, resolveName, deleteStorage, destroy } = SDKcb(opts)

  const localStorage = getLocalstorage((opts || {}).storageOpts)

  function isLocal (key) {
    try {
      const current = listLocal()
      return current.includes(key)
    } catch (e) {
      return false
    }
  }

  function listLocal () {
    try {
      return JSON.parse(localStorage.getItem('dats'))
    } catch (e) {
      return []
    }
  }

  function addLocal (key) {
    try {
      const current = listLocal()
      saveLocal(current.concat(key))
    } catch (e) {
      saveLocal([key])
    }
  }

  function saveLocal (list) {
    localStorage.setItem('dats', JSON.stringify(list))
  }

  async function reallyReady (archive) {
    if (archive.writable) return

    const files = new Promise((resolve, reject) => {
      archive.readdir('/', (err, files) => err ? resolve([]) : resolve(files))
    })

    if (files.length) return

    return new Promise((resolve, reject) => {
      function cb (err, result) {
        // Ignore errors saying we're up to date
        if (err && err.message !== 'No update available from peers') reject(err)
        else resolve(result)
      }
      if (archive.metadata.peers.length) {
        archive.metadata.update({ ifAvailable: true }, cb)
      } else {
        const timeout = setTimeout(cb, READY_DELAY)
        archive.metadata.once('peer-add', () => {
          clearTimeout(timeout)
          archive.metadata.update({ ifAvailable: true }, cb)
        })
      }
    })
  }

  async function getURLData (url) {
    let key = null
    let version = null

    if (url) {
      if (!url.startsWith('dat://') && !url.startsWith('http://') && !url.startsWith('https://')) {
        url = `dat://${url}`
      }
      const parsed = parseURL(url)
      let hostname = null
      const isDat = parsed.protocol.indexOf('dat') === 0
      const isUndefined = parsed.protocol.indexOf('undefined') === 0
      if (isDat || isUndefined) {
        const hostnameParts = parsed.hostname.split('+')
        hostname = hostnameParts[0]
        version = hostnameParts[1] || null
      } else {
        const hostnameParts = parsed.hostname.split('.')
        const subdomain = hostnameParts[0]
        if (subdomain.length === BASE_32_KEY_LENGTH) {
          hostname = hexTo32.decode(subdomain)
        } else {
          hostname = parsed.hostname
        }
      }

      key = await DatArchive.resolveName(`dat://${hostname}`)
    }

    return {
      key,
      version
    }
  }

  class DatArchive extends EventTarget {
    constructor (url, options = {}) {
      super()
      this.url = url

      this._loadPromise = Promise.resolve().then(async () => {
        const { key, version } = await getURLData(url)

        let archive = null

        const localOptions = {
          persist: false
        }

        if (key) {
          if (isLocal(key)) {
            localOptions.persist = true
          }
          const finalOptions = Object.assign(localOptions, options)
          archive = Hyperdrive(key, finalOptions)
        } else {
          localOptions.persist = true
          const finalOptions = Object.assign(localOptions, options)

          archive = Hyperdrive(null, finalOptions)
          const keyHex = archive.metadata.key.toString('hex')
          addLocal(`dat://${keyHex}`)
        }

        this._archive = archive

        await waitReady(archive)

        await reallyReady(archive)

        this._archive.once('close', () => {
          this.send('close', { target: this })
        })

        this._checkout = version ? archive.checkout(version) : archive
        this.url = this.url || `dat://${archive.key.toString('hex')}`
        this._loadPromise = null

        var s = toEventTarget(pda.createNetworkActivityStream(this._archive))

        s.addEventListener('network-changed', detail =>
          this.send('network-changed', { target: this, ...detail })
        )

        s.addEventListener('download', detail =>
          this.send('download', { target: this, ...detail })
        )

        s.addEventListener('upload', detail =>
          this.send('upload', { target: this, ...detail })
        )

        s.addEventListener('sync', detail =>
          this.send('sync', { target: this, ...detail })
        )
      })
    }

    async getSecretKey () {
      await this._loadPromise
      return this._archive.metadata.secretKey
    }

    async getInfo (opts = {}) {
      return timer(to(opts), async () => {
        await this._loadPromise

        // read manifest
        var manifest
        try {
          manifest = await pda.readManifest(this._checkout)
        } catch (e) {
          manifest = {}
        }

        // return
        return {
          key: this._archive.key.toString('hex'),
          url: this.url,
          isOwner: this._archive.writable,

          // state
          version: this._checkout.version,
          peers: this._archive.metadata.peers.length,
          mtime: 0,
          size: 0,

          // manifest
          title: manifest.title,
          description: manifest.description,
          type: manifest.type,
          author: manifest.author
        }
      })
    }

    async configure (settings) {
      await this._loadPromise
      if (!settings || typeof settings !== 'object') throw new Error('Invalid argument')
      if ('title' in settings || 'description' in settings || 'type' in settings || 'author' in settings) {
        await pda.updateManifest(this._archive, settings)
      }
    }

    async diff () {
      // noop
      return []
    }

    async commit () {
      // noop
      return []
    }

    async revert () {
      // noop
      return []
    }

    async history (opts = {}) {
      return timer(to(opts), async () => {
        await this._loadPromise
        var reverse = opts.reverse === true
        var { start, end } = opts

        // if reversing the output, modify start/end
        start = start || 0
        end = end || this._checkout.metadata.length
        if (reverse) {
          // swap values
          const t = start
          start = end
          end = t
          // start from the end
          start = this._checkout.metadata.length - start
          end = this._checkout.metadata.length - end
        }

        return new Promise((resolve, reject) => {
          var stream = this._checkout.history({ live: false, start, end })
          stream.pipe(concat({ encoding: 'object' }, values => {
            values = values.map(massageHistoryObj)
            if (reverse) values.reverse()
            resolve(values)
          }))
          stream.on('error', reject)
        })
      })
    }

    async stat (filepath, opts = {}) {
      filepath = massageFilepath(filepath)
      return timer(to(opts), async () => {
        await this._loadPromise
        return pda.stat(this._checkout, filepath)
      })
    }

    async readFile (filepath, opts = {}) {
      filepath = massageFilepath(filepath)
      return timer(to(opts), async () => {
        await this._loadPromise
        return pda.readFile(this._checkout, filepath, opts)
      })
    }

    watch (pathPattern, onInvalidated) {
      if (typeof pathPattern === 'function') {
        onInvalidated = pathPattern
        pathPattern = null
      }

      if (this._loadPromise) {
        var proxy = new EventTarget()
        this._loadPromise.then(() => {
          var evts = this.watch(pathPattern, onInvalidated)
          evts.addEventListener('invalidated', (e) => {
            proxy.send('invalidated', e)
          })
          evts.addEventListener('changed', (e) => {
            proxy.send('changed', e)
          })
        })
        return proxy
      }

      var evts = toEventTarget(pda.watch(this._archive, pathPattern))
      if (onInvalidated) evts.addEventListener('invalidated', onInvalidated)
      return evts
    }

    async writeFile (filepath, data, opts = {}) {
      filepath = massageFilepath(filepath)
      return timer(to(opts), async () => {
        await this._loadPromise
        if (this._version) throw new ArchiveNotWritableError('Cannot modify a historic version')
        await assertWritePermission(this._archive)
        await assertValidFilePath(filepath)
        await assertUnprotectedFilePath(filepath)
        return pda.writeFile(this._archive, filepath, data, opts)
      })
    }

    async unlink (filepath) {
      filepath = massageFilepath(filepath)
      return timer(to(), async () => {
        await this._loadPromise
        if (this._version) throw new ArchiveNotWritableError('Cannot modify a historic version')
        await assertWritePermission(this._archive)
        await assertUnprotectedFilePath(filepath)
        return pda.unlink(this._archive, filepath)
      })
    }

    async download (filepath, opts = {}) {
      filepath = massageFilepath(filepath)
      return timer(to(opts), async (checkin) => {
        await this._loadPromise
        if (this._version) throw new Error('Not yet supported: can\'t download() old versions yet. Sorry!') // TODO
        if (this._archive.writable) {
          return // no need to download
        }
        return pda.download(this._archive, filepath)
      })
    }

    async readdir (filepath, opts = {}) {
      filepath = massageFilepath(filepath)
      return timer(to(opts), async () => {
        await this._loadPromise
        var names = await pda.readdir(this._checkout, filepath, opts)
        if (opts.stat) {
          for (let i = 0; i < names.length; i++) {
            names[i] = {
              name: names[i],
              stat: await pda.stat(this._checkout, path.join(filepath, names[i]))
            }
          }
        }
        return names
      })
    }

    async mkdir (filepath) {
      filepath = massageFilepath(filepath)
      return timer(to(), async () => {
        await this._loadPromise
        if (this._version) throw new ArchiveNotWritableError('Cannot modify a historic version')
        await assertWritePermission(this._archive)
        await assertValidPath(filepath)
        await assertUnprotectedFilePath(filepath)
        return pda.mkdir(this._archive, filepath)
      })
    }

    async rmdir (filepath, opts = {}) {
      return timer(to(opts), async () => {
        filepath = massageFilepath(filepath)
        await this._loadPromise
        if (this._version) throw new ArchiveNotWritableError('Cannot modify a historic version')
        await assertUnprotectedFilePath(filepath)
        return pda.rmdir(this._archive, filepath, opts)
      })
    }

    async copy (path, dstPath, opts) {
      path = massageFilepath(path)
      dstPath = massageFilepath(dstPath)
      return timer(to(opts), async () => {
        await this._loadPromise
        await pda.copy(this._archive, path, dstPath)
      })
    }

    async rename (filepath, dstpath, opts) {
      filepath = massageFilepath(filepath)
      dstpath = massageFilepath(dstpath)
      return timer(to(opts), async () => {
        await this._loadPromise
        await pda.rename(this._archive, filepath, dstpath)
      })
    }

    createFileActivityStream (pathPattern) {
      return toEventTarget(pda.watch(this._archive, pathPattern))
    }

    createNetworkActivityStream () {
      return toEventTarget(pda.createNetworkActivityStream(this._archive))
    }

    async close () {
      await this._loadPromise
      return new Promise((resolve) => {
        this._archive.close(resolve)
      })
    }

    static async resolveName (name) {
      // If it's already a valid dat URL, don't bother resolving it
      // Avoids the case where you can't load an archive while offline
      if (name.match(DAT_KEY_URL_REGEX)) {
        return name
      }
      return new Promise((resolve, reject) => {
        resolveName(name, (err, resolved) => {
          if (err) reject(err)
          else resolve(resolved)
        })
      })
    }

    static async fork (url, opts) {
      const srcDat = new DatArchive(url)

      const destDat = await DatArchive.create(opts)

      await srcDat._loadPromise

      await pda.exportArchiveToArchive({
        srcArchive: srcDat._archive,
        dstArchive: destDat._archive
      })

      return destDat
    }

    static async selectArchive (options) {
      const urls = listLocal()
      const archives = urls.map((url) => new DatArchive(url))

      const info = await Promise.all(archives.map((archive) => archive.getInfo()))

      const message = `
   Please choose a Dat Archive:
   ${info.map(({ url, title }, index) => `${index}. ${title || 'Untitled'}: ${url}`).join('\n')}
   `

      const selection = prompt(message, 0)

      const archive = archives[selection]

      if (!archive) throw new Error('Archive Not Found', selection)

      return archive
    }

    static async create (options = {}) {
      const { title, description, type, author } = options
      const archive = new DatArchive(null, options)

      await archive._loadPromise

      await pda.writeManifest(archive._archive, { url: archive.url, title, description, type, author })

      return archive
    }

    static async load (url, options) {
      const archive = new DatArchive(url, options)

      await archive._loadPromise

      return archive
    }

    static async unlink (url) {
      const key = await DatArchive.resolveName(url)

      return new Promise((resolve, reject) => {
        deleteStorage(key, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    }
  }

  function destroyPromise (cb) {
    return new Promise((resolve, reject) => {
      destroy((err) => {
        if (cb) cb(err)
        if (err) reject(err)
        else resolve()
      })
    })
  }

  return {
    DatArchive,
    destroy: destroyPromise
  }
}

// helper to check if filepath refers to a file that userland is not allowed to edit directly
function assertUnprotectedFilePath (filepath) {
  if (filepath === '/' + DAT_MANIFEST_FILENAME) {
    throw new ProtectedFileNotWritableError()
  }
}

async function assertWritePermission (archive) {
  // ensure we have the archive's private key
  if (!archive.writable) {
    throw new ArchiveNotWritableError()
  }
  return true
}

async function assertValidFilePath (filepath) {
  if (filepath.slice(-1) === '/') {
    throw new InvalidPathError('Files can not have a trailing slash')
  }
  await assertValidPath(filepath)
}

async function assertValidPath (fileOrFolderPath) {
  if (!DAT_VALID_PATH_REGEX.test(fileOrFolderPath)) {
    throw new InvalidPathError('Path contains invalid characters')
  }
}

function massageHistoryObj ({ name, version, type }) {
  return { path: name, version, type }
}

function massageFilepath (filepath) {
  filepath = filepath || ''
  filepath = decodeURIComponent(filepath)
  if (!filepath.startsWith('/')) {
    filepath = '/' + filepath
  }
  return filepath
}

function waitReady (archive) {
  return new Promise((resolve, reject) => {
    archive.ready((err) => {
      if (err) reject(err)
      else resolve(archive)
    })
  })
}

const to = (opts) =>
  (opts && typeof opts.timeout !== 'undefined')
    ? opts.timeout
    : API_TIMEOUT

function timer (ms, fn) {
  var currentAction
  var isTimedOut = false

  // no timeout?
  if (!ms) return fn(() => false)

  return new Promise((resolve, reject) => {
    // start the timer
    const timer = setTimeout(() => {
      isTimedOut = true
      reject(new TimeoutError(currentAction ? `Timed out while ${currentAction}` : undefined))
    }, ms)

    // call the fn to get the promise
    var promise = fn(action => {
      if (action) currentAction = action
      return isTimedOut
    })

    // wrap the promise
    promise.then(
      val => {
        clearTimeout(timer)
        resolve(val)
      },
      err => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

function toEventTarget (es) {
  var target = new EventTarget()
  es.on('data', ([event, args]) => target.send(event, args))
  target.close = es.destroy.bind(es)
  return target
}
