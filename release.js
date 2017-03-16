const exec = require('child_process').exec
  , jsonPackage = require('../package.json')
  , prependFile = require('prepend-file')
  , reader = require('./lib/changelog-gen/reader')
  , generator = require('./lib/changelog-gen/generator')
  , args = process.argv.slice(2)
  , repoInfo = /\/\/[^\/]*\/([^\/]*)\/([^\/]*).git/g.exec(jsonPackage.repository.url)
  , owner = repoInfo[1]
  , repo = repoInfo[2]

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
  console.log('\noptional:')
  console.log('       --help        Show this help')
  console.log('       --dry-run     Generate changelog but do not release')
  console.log('       --gh-token    Your github token')
  console.log('       --output      Changelog file (stdout will be used if this option is not set)')
}

const writeChangelog = (changeLog, file) => {
  prependFile(file, changeLog, 'utf8')
}

if (args.includes('--help')) {
  help()
  process.exit(1)
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

exec(`cd ../ && git fetch && git log --abbrev-commit origin/${fromTag}..origin/${toTag} | grep "pull request" | awk '{gsub(/#/, ""); print $4}'`, (error, stdout, stderr) => {
  if (error) {
    console.error(error)
    return
  }
  if (stderr) {
    console.error(stderr)
    return
  }

  let prs = stdout.split('\n')
  let promises = []

  prs.forEach(id => {
    promises.push(reader.readFromGithub(owner, repo, id, ghToken))
  })
  Promise.all(promises)
    .then(prs => {
      const
        changeLog = generator.generate(owner, repo, tag, jsonPackage.version, prs)

      if (outputFile) {
        writeChangelog(changeLog, outputFile)
      } else {
        console.log(changeLog)
      }

      if (!dryRun) {
        // todo release
      }
    })
    .catch(err => {
      console.error(err)
    })
})
