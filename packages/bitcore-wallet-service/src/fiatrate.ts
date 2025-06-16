#!/usr/bin/env node

var spawn = require('child_process').spawn;
var async = require('async');

var scripts = [
  'fiatrateservice/fiatrateservice.js',
];

async.eachSeries(scripts, function (script, callback) {
  console.log(`Spawning ${script}`);

  const node = spawn('node', [script]);
  node.stdout.on('data', data => {
    console.log(`${data}`);
  });
  node.stderr.on('data', data => {
    console.error(`${data}`);
  });

});

console.log('Fiatrate parent process running, keeping alive...');
setInterval(() => {}, 60000);
