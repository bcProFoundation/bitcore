'use strict';

var startGulp = require('@abcpros/bitcore-build');
Object.assign(exports, startGulp('p2p', {skipBrowser: true}))
