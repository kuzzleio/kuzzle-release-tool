const
  exec = require('../exec-promise'),
   yaml = require('yamljs'),
   compat = require('../../compat.json'),
   config = require('../../config.json'),
   fs = require('fs'),
   ask = require('../ask'),
   spawn = require('child_process').spawn,
   https = require('https'),
   async = require('async'),
   rp = require('request-promise')

let travisyml = yaml.load('./kuzzle-test-environment/.travis.yml')

const getBuilds = () => {
  return rp({
    uri: `${config.ci.api}/repos/kuzzleio/kuzzle-test-environment/builds`,
     headers: {
      'User-Agent': 'ci-changelog'
    },
     json: true
  })
}

const waitForBuildToStart = (cb) => {
  getBuilds()
    .then(result => {
      result = result.filter(build => build.state === 'started')
      if (result.length <= 0) {
        cb(true)
      } else {
        cb(null, result[0])
      }
    })
    .catch(err => {
      cb(err)
    })
}

const cliSpinner = () => {
  const P = ["\\", "|", "/", "-"];
  let x = 0;

  return setInterval(() => {
    process.stdout.write("\r" + P[x++])
    x &= 3
  }, 250)
}

module.exports = class TestEnvironment {
  constructor(owner, repo, tag, ghToken) {
    this.owner = owner
    this.repo = repo
    this.tag = tag
    this.ghToken = ghToken
  }

  createProposalBranch () {
    return exec(`cd kuzzle-test-environment && git checkout -b ${this.tag}`)
  }

  pushProposalBranch () {
    return exec(`cd kuzzle-test-environment && git commit -am "Update travis.yml for release" && git push origin ${this.tag}`)
  }

  deleteProposalBranch () {
    return exec(`cd kuzzle-test-environment && git branch | grep ${this.tag}`)
      .then(() => exec(`cd kuzzle-test-environment && (git push origin --delete ${this.tag} ; git checkout master ; git branch -D ${this.tag})`))
      .catch(() => Promise.resolve())
  }

  writeMatrix () {
    return new Promise((resolve, reject) => {
      fs.writeFile('kuzzle-test-environment/.travis.yml', yaml.stringify(travisyml, 3), err => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }

  reviewTravisYml () {
    let matrix = {}

    matrix.KUZZLE_REPO = compat.KUZZLE_REPO
    matrix.KUZZLE_VERSION = compat.KUZZLE_VERSION
    matrix.PROXY_REPO = compat.PROXY_REPO
    matrix.PROXY_VERSION = compat.PROXY_VERSION

    travisyml.env.matrix = [matrix]

    return ask(`Are you sure you want to run the tests with this environment?\n\x1b[33m${yaml.stringify(travisyml)}\x1b[0m\n(Y|n)`)
  }

  getBuildNumber () {
    return exec(`cd kuzzle-test-environment && travis login --github-token ${this.ghToken} && travis branches | grep ${this.tag} | awk '{gsub(/#/, ""); print $2}'`)
      .then(build => build.replace('\n', ''))
  }

  getTravisBuildId (branch) {
    return getBuilds()
      .then(result => {
        result = result.filter(build => {
          return build.branch === branch
        })

        if (result.length <= 0) {
          return Promise.reject()
        } else {
          return Promise.resolve(result[0].id)
        }
      })
      .catch(err => {
        return Promise.reject(err)
      })
  }

  streamLog (build) {
    return new Promise((resolve, reject) => {
      const spinner = cliSpinner()

      async.retry({times: config.ci.totalRetry, interval: config.ci.retryInterval}, waitForBuildToStart, (err) => {
        if (err) {
          return reject(err)
        }

        clearInterval(spinner)
        const child = spawn('travis', ['logs', build], {stdio: 'inherit', cwd: './kuzzle-test-environment'})

        child.on('close', () => {
          // Get status of the travis build
          exec(`cd kuzzle-test-environment && travis login --github-token ${this.ghToken} && travis show ${build} | grep State | awk '{print $2}'`)
            .then(status => {
              status = status.replace('\n', '')

              // Travis will say 'failed' while we want to set the status of the github PR to 'error'
              if (status === 'failed') {
                status = 'error'
              }
              return resolve({build, status})
            })
            .catch(err => {
              reject(err)
            })
        })
      })
    })
  }
}
