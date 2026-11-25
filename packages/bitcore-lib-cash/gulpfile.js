
const startGulp = require('@bcpros/bitcore-build');

Object.assign(
  exports,
  startGulp(
    'lib',
    { browserRunner: 'webdriverio' }
  )
);