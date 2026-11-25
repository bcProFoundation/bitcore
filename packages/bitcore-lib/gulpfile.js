'use strict';

const startGulp = require('@bcpros/bitcore-build');

module.exports = startGulp('lib', {
  browserRunner: 'webdriverio'
});
