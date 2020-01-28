const envPaths = require('env-paths')
const path = require('path')
const LocalStorage = require('node-localstorage').LocalStorage

module.exports = function (storageOpts) {
  if (!storageOpts) {
    storageOpts = { application: 'dat' }
  }

  let storageLocation = storageOpts.storageLocation || envPaths(storageOpts.application).data
  storageLocation = path.join(storageLocation, 'localStorage')

  return new LocalStorage(storageLocation)
}
