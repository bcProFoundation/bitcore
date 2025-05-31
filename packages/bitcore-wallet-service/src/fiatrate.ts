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

  node.on('exit', (code: number, signal: string) => {
    console.log(`Process ${script} exited with code ${code} and signal ${signal}`);
    process.exit(1); // Exit with non-zero code to crash the container
  });

  callback();
});
