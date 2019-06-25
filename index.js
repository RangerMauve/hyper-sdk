const discovery = require('hyperdiscovery')
const datStorage = require('universal-dat-storage')
const DatEncoding = require('dat-encoding')

const hyperdrive = require('hyperdrive')
const hypercore = require('hypercore')
const corestore = require('random-access-corestore')

const thunky = require('thunky')

const DRIVE = new Symbol('drive')
const CORE = new Symbol('core')

function SDK ({ storageOpts, swarmOpts, driveOpts, coreOpts }) {
  const storage = datStorage(storageOpts)
  const swarm = discovery(swarmOpts)

  class Hyperdrive {
    constructor (location, opts) {
      opts = Object.assign({}, driveOpts, opts)
      let key = null
      if(!location) {
        const { publicKey, secretKey } = crypto.keyPair()
        key = publicKey
        location = DatEncoding.encode(publicKey)
        opts.secretKey = secretKey
      }

      try {
        const key = DatEncoding.decode(location)
      } catch(e) {
        // Location must be relative path
      }

      this[DRIVE] = hyperdrive(storage.getDrive(location), key, opts)

      this.ready = thunky((cb) => {
        this[DRIVE].ready(() => {
          discovery.add(this[DRIVE])
          cb()
        })
      })
    }
  }

  class Hypercore {
    constructor (location) {
      this.ready = thunky((cb) => {
        this.__initialize(cb)
      })
    }
  }

  class Corestore {
    constructor (location) {
      this.ready = thunky((cb) => {
        this.__initialize(cb)
      })
    }
  }

  return {
    Hyperdrive,
    Hypercore,
    Corestore
  }
}
