const run = require('./tests')
const createNative = require('./lib/native')

run(createNative, 'native')
