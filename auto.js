const global = require('global')

if (global.DatArchive) {
  module.exports = {
    DatArchive: global.DatArchive,
    destroy: () => void 0
  }
} else {
  module.exports = require('./promise')()
}
