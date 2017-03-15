const exec = require('child_process').exec
  , https = require('https')
  , jsonPackage = require('../package.json')
  , prependFile = require('prepend-file')
  , args = process.argv.slice(2)
  , issueRegex = /(resolve[s|d]?|close[s|d]?|fixe?[s|d]?) #([0-9]+)/g

let ghToken
  , toTag
  , fromTag
  , changeLog

const help = () => {
  console.log('usage:')
  console.log('       --gh-token    Your github token')
  console.log('       --from        The git tag you want to start the release from')
  console.log('       --to          The git tag you want to stop the release to')
}

const fetchPRInfo = (id) => {
  return new Promise((resolve, reject) => {
    if (!id) {
      return resolve(null)
    }
    https.get({
        headers: {
          'user-agent': 'ci-changelog'
        }
        , host: 'api.github.com'
        , path: `/repos/kuzzleio/kuzzle-backoffice/issues/${id}?access_token=${ghToken}`
      }, response => {
        var str = ''

        response.on('data', function (chunk) {
          str += chunk
        })

        response.on('end', function () {
          resolve(filterInfos(id, JSON.parse(str)))
        })
      }).on('error', e => {
      reject(e)
    })
  })
}

const filterInfos = (id, infos) => {
  if (!infos) {
    return null
  }
  let labels = []

  if (infos.labels) {
    labels = infos.labels
      .map(e => e.name)
      // .filter(e => e[0] === ':')
      // .map(e => e.replace(':', ''))
  }

  if (labels.length >= 0) {
    let m
      , issues = []

    while ((m = issueRegex.exec(infos.body)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === issueRegex.lastIndex) {
        issueRegex.lastIndex++
      }

      issues.push(m[2])
    }

    return {
      labels
      , id
      , title: infos.title.charAt(0).toUpperCase() + infos.title.slice(1)
      , issues
    }
  }
}

const generateChangelog = (prs) => {
  let parts = {}
  parts['Merged pull request'] = []

  for (let pr of prs) {
    if (!pr) continue

    // if no label, put in default one
    if (pr.labels.length === 0) {
      delete pr.labels
      parts['Merged pull request'].push(pr)
    } else {
      for (let l of pr.labels) {
        if (!parts[l]) {
          parts[l] = []
        }

        delete pr.labels
        parts[l].push(pr)
      }
    }
  }

  changeLog += `[[v42](https://github.com/kuzzleio/${jsonPackage.name}/releases/tag/42)]`
  prependFile('/tmp/log.json', changeLog, 'utf8')
  console.log(parts)
}

if (args.includes('--help')) {
  help()
  process.exit(1)
}

ghToken = args.includes('--gh-token') ? args[args.indexOf('--gh-token') + 1] : null
toTag = args.includes('--to') ? args[args.indexOf('--to') + 1] : null
fromTag = args.includes('--from') ? args[args.indexOf('--from') + 1] : null

if (!ghToken || !toTag || !fromTag) {
  help()
  process.exit(1)
}

exec(`cd ../ && git log --abbrev-commit ${fromTag}..origin/${toTag} | grep "pull request" | awk '{gsub(/#/, ""); print $4}'`, (error, stdout, stderr) => {
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
    promises.push(fetchPRInfo(id))
  })
  Promise.all(promises)
    .then(res => {
      generateChangelog(res)
    })
    .catch(err => {
      console.error(err)
    })
})
