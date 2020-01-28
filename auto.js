const global = require('global')

if (global.DatArchive) {
  module.exports = {
    DatArchive: global.DatArchive,
    destroy: () => undefined
  }
} else {
  module.exports = require('./promise')()
}
