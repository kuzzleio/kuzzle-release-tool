const
  fs = require('fs');

module.exports = {
  hasTestEnv () {
    return new Promise((resolve, reject) => {
      fs.stat('./kuzzle-test-environment', err => {
        if (err) {
          return reject(new Error('You must clone kuzzle-release-tool into this repo. git submodule update --recursive'));
        }
        resolve();
      });
    });
  }
};
