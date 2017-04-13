const exec = require('child_process').exec
  , jsonPackage = require('../package.json')
  , prependFile = require('prepend-file')
  , reader = require('./lib/changelog-gen/reader')
  , generator = require('./lib/changelog-gen/generator')
  , branch = require('./lib/release-mgr/branch')
  , prerequisite = require('./lib/prerequisite')
  , testEnv = require('./lib/release-mgr/test-env')
  , bumper = require('./lib/release-mgr/bumper')
  , pr = require('./lib/release-mgr/pull-request')
  , compat = require('./compat.json')
  , ask = require('./lib/ask')
  , crypto = require('crypto')
  , args = process.argv.slice(2)
  , repoInfo = /\/\/[^\/]*\/([^\/]*)\/([^\/]*).git/g.exec(jsonPackage.repository.url)
  , owner = repoInfo[1]
  , repo = repoInfo[2]
  , envTestBranchName = crypto.createHmac('sha256', Math.random().toString()).digest('hex')

  let ghToken
    , toTag
    , fromTag
    , tag
    , dryRun
    , outputFile

const help = () => {
  console.log('usage:')
  console.log('       --from        The git tag you want to start the release from')
  console.log('       --to          The git tag you want to stop the release to')
  console.log('       --tag         Tag to release')
  console.log('       --gh-token    Your github token')
  console.log('\noptional:')
  console.log('       --help        Show this help')
  console.log('       --dry-run     Generate changelog and run tests but do not release')
  console.log('       --output      Changelog file (stdout will be used if this option is not set)')
}

if (args.includes('--help')) {
  help()
  process.exit(1)
}

process.on('exit', () => {
  testEnv.deleteProposalBranch(envTestBranchName)
  branch.delete(`${tag}-proposal`)
})

const writeChangelog = (changeLog, file) => {
  return new Promise((resolve, reject) => {
    prependFile(file, changeLog, 'utf8', err => {
      if (err) {
        return reject(err)
      }
      resolve()
    })
  })
}

ghToken = args.includes('--gh-token') ? args[args.indexOf('--gh-token') + 1] : null
toTag = args.includes('--to') ? args[args.indexOf('--to') + 1] : null
fromTag = args.includes('--from') ? args[args.indexOf('--from') + 1] : null
tag = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : null
dryRun = args.includes('--dry-run')
outputFile = args.includes('--output') ? args[args.indexOf('--output') + 1]: null

if (!tag || !toTag || !fromTag) {
  help()
  process.exit(1)
}

const makeChangelog = () => {
  return new Promise((resolve, reject) => {
    exec(`cd ../ && git fetch ; git log --abbrev-commit origin/${fromTag}..origin/${toTag} | grep "pull request" | awk '{gsub(/#/, ""); print $4}'`, (error, stdout) => {
      if (error) {
        console.error(error)
        return
      }

      let prs = stdout.split('\n')
      let promises = []

      prs.forEach(id => {
        if (id) {
          promises.push(reader.readFromGithub(owner, repo, id, ghToken))
        }
      })

      Promise.all(promises)
        .then(result => generator.generate(owner, repo, tag, jsonPackage.version, result))
        .then(changeLog => {
          if (outputFile) {
            return writeChangelog(changeLog, outputFile)
              .then(() => resolve(changeLog))
          } else {
            console.log(changeLog)
            resolve(changeLog)
          }
        })
        .catch(err => {
          if (err) {
            console.error(err)
          }
          reject()
        })
    })
  })
}

const prepareRelease = () => {
  let changelog

  return branch.create(tag)
    .then(() => makeChangelog())
    .then((changes) => {
      changelog = changes

      return bumper.bumpVersion(tag, jsonPackage)
    })
    .then(() => branch.push(tag))
    .then(() => pr.create(owner, repo, ghToken, tag, changelog))
    .then(issue => pr.updateLabels(owner, repo, issue.number, ghToken))
}

const runTest = () => {
  return branch.getCurrent()
    .then(branch => ask(`You are about to make a release based on branch ${branch}with compat.json: ${JSON.stringify(compat, null, 2)}\nAre you sure you want to release? (Y|n) `))
    .then(() => testEnv.reviewTravisYml())
    .then(() => testEnv.createProposalBranch(envTestBranchName))
    .then(() => testEnv.writeMatrix())
    .then(() => testEnv.pushProposalBranch(envTestBranchName))
    .then(() => testEnv.streamLog(ghToken, envTestBranchName))
}

// Let's run everything
prerequisite.hasTestEnv()
  .then(() => {
    runTest()
      .then(() => prepareRelease())
      .then(() => process.exit(0))
      .catch(err => {
        if (err) {
          console.error(err)
        }
        process.exit(1)
      })
  })
  .catch(() => {
    console.error('You must clone kuzzle-release-tool into this repo. git submodule update --recursive')
  })