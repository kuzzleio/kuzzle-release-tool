const
  exec = require('../exec-promise')
  , yaml = require('yamljs')
  , compat = require('../../compat.json')
  , fs = require('fs')
  , ask = require('../ask')
  , cp = require('child_process')
  , spawn = require('child_process').spawn
  , https = require('https')
  , async = require('async')

let travisyml = yaml.load('./kuzzle-test-environment/.travis.yml')

const getBuildFromTravis = (cb) => {
  let result = ''

  https.get({
    hostname: 'api.travis-ci.org'
    , path: '/repos/kuzzleio/kuzzle-test-environment/builds'
    , headers: {
      'User-Agent': 'ci-changelog'
      , Accept: 'application/vnd.travis-ci.2+json'
      , Host: 'api.travis-ci.org'
    }
  }, (res) => {
    res.on('data', data => {
      result += data
    })

    res.on('end', () => {
      result = JSON.parse(result)
      result = result.builds.filter(build => build.state === 'started')
      if (result.length <= 0) {
        cb(true)
      } else {
        cb(null, result)
      }
    })
  }).on('error', err => {
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

module.exports = {
  createProposalBranch (tag) {
    return exec(`cd kuzzle-test-environment && git checkout -b ${tag}`)
  }
  , pushProposalBranch (tag) {
    return exec(`cd kuzzle-test-environment && git commit -am "Update travis.yml for release" && git push origin ${tag}`)
  }
  , deleteProposalBranch (tag) {
    return exec(`cd kuzzle-test-environment && git push origin --delete ${tag} ; git checkout master ; git branch -D ${tag}`)
  }
  , writeMatrix () {
    return new Promise((resolve, reject) => {
      fs.writeFile('kuzzle-test-environment/.travis.yml', yaml.stringify(travisyml, 3), err => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }
  , reviewTravisYml () {
    let matrix = {}

    matrix.KUZZLE_REPO = compat.KUZZLE_REPO
    matrix.KUZZLE_VERSION = compat.KUZZLE_VERSION
    matrix.PROXY_REPO = compat.PROXY_REPO
    matrix.PROXY_VERSION = compat.PROXY_VERSION

    travisyml.env.matrix = [matrix]

    return ask(`Are you sure you want to run the tests with this environment?\n${yaml.stringify(travisyml)}\n(Y|n)`)
  }
  , editTravisYml () {
    return new Promise((resolve, reject) => {
      const child = cp.spawn(process.env.EDITOR, ['kuzzle-test-environment/.travis.yml'], {
        stdio: 'inherit'
      })

      child.on('exit', () => {
        resolve()
      })

      child.on('error', err => {
        reject(err)
      })
    })
  }
  , streamLog (ghToken) {
    return new Promise((resolve, reject) => {
      const spinner = cliSpinner()

      async.retry({times: 50, interval: 500}, getBuildFromTravis, (err) => {
        if (err) {
          return reject(err)
        }
        exec(`cd kuzzle-test-environment && travis login --github-token ${ghToken}`)
          .then(() => {
            clearInterval(spinner)
            const child = spawn('travis', ['logs'], {stdio: 'inherit', cwd: './kuzzle-test-environment'})

            child.on('close', () => {
              exec(`cd kuzzle-test-environment && travis login --github-token ${ghToken} && travis status`)
                .then(res => {
                  if (res.includes('passed')) {
                    return resolve()
                  }
                  reject(res)
                })
                .catch(err => {
                  reject(err)
                })
            })
          })
          .catch(err => {
            clearInterval(spinner)
            reject(err)
          })
      })
    })
  }
}
