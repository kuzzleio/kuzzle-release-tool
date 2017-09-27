const
  exec = require('../exec-promise'),
  yaml = require('yamljs'),
  compat = require('../../compat.json'),
  config = require('../../config.json'),
  fs = require('fs'),
  ask = require('../ask'),
  spawn = require('child_process').spawn,
  async = require('async'),
  rp = require('request-promise');

const travisyml = yaml.load('./kuzzle-test-environment/.travis.yml');

function getBuilds () {
  return rp({
    uri: `${config.ci.api}/repos/kuzzleio/kuzzle-test-environment/builds`,
    headers: {
      'User-Agent': 'ci-changelog'
    },
    json: true
  });
}

function waitForBuildToStart (cb) {
  getBuilds()
    .then(result => {
      result = result.filter(build => build.state === 'started');
      if (result.length <= 0) {
        cb(true);
      } else {
        cb(null, result[0]);
      }
    })
    .catch(err => {
      cb(err);
    });
}

function cliSpinner () {
  const P = ['\\', '|', '/', '-'];
  let x = 0;

  return setInterval(() => {
    process.stdout.write('\r' + P[x++]);
    x &= 3;
  }, 250);
}

module.exports = class TestEnvironment {
  constructor(owner, repo, tag, ghToken) {
    this.owner = owner;
    this.repo = repo;
    this.tag = tag;
    this.ghToken = ghToken;
  }

  createProposalBranch() {
    return exec(`cd kuzzle-test-environment && git checkout master && git branch ${this.tag} origin/master && git checkout ${this.tag}`);
  }

  pushProposalBranch() {
    return exec(`cd kuzzle-test-environment && git commit -am "Update travis.yml for release" && git push origin ${this.tag}`);
  }

  deleteProposalBranch() {
    return exec(`cd kuzzle-test-environment && git branch | grep ${this.tag}`)
      .then(() => exec(`cd kuzzle-test-environment && (git push origin --delete ${this.tag} ; git checkout master ; git branch -D ${this.tag})`))
      .catch(() => Promise.resolve());
  }

  writeMatrix() {
    return new Promise((resolve, reject) => {
      fs.writeFile('kuzzle-test-environment/.travis.yml', yaml.stringify(travisyml, 3), err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  reviewTravisYml() {
    const matrix = {
      KUZZLE_REPO: compat.KUZZLE_REPO,
      KUZZLE_VERSION: compat.KUZZLE_VERSION,
      PROXY_REPO: compat.PROXY_REPO,
      PROXY_VERSION: compat.PROXY_VERSION
    };
    
    travisyml.env.matrix = [matrix];

    return ask(`Please confirm your .travis.yml: \n\x1b[33m${yaml.stringify(travisyml)}\x1b[0m\n(Y|n)`);
  }

  getBuildNumber() {
    return exec(`cd kuzzle-test-environment && travis login --github-token ${this.ghToken} && travis branches | grep ${this.tag} | awk '{gsub(/#/, ""); print $2}'`)
      .then(build => build.replace('\n', ''));
  }

  getTravisBuildId(branch) {
    return getBuilds()
      .then(result => {
        const _result = result.filter(build => build.branch === branch);

        if (_result.length === 0) {
          return Promise.reject(new Error('No Travis build found'));
        }

        return Promise.resolve(_result[0].id);
      });
  }

  streamLog(build) {
    return new Promise((resolve, reject) => {
      const spinner = cliSpinner();

      async.retry({times: config.ci.totalRetry, interval: config.ci.retryInterval}, waitForBuildToStart, err => {
        if (err) {
          return reject(err);
        }

        clearInterval(spinner);
        const child = spawn('travis', ['logs', build], {stdio: 'inherit', cwd: './kuzzle-test-environment'});

        child.on('close', () => {
          // Get status of the travis build
          exec(`cd kuzzle-test-environment && travis login --github-token ${this.ghToken} && travis show ${build} | grep State | awk '{print $2}'`)
            .then(status => {
              let _status = status.trim();

              // Travis will say 'failed' while we want to set the status of the github PR to 'error'
              if (_status === 'failed') {
                _status = 'error';
              }
              return resolve({build, _status});
            })
            .catch(err2 => reject(err2));
        });
      });
    });
  }
};
