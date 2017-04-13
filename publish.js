const
  config = require('./config.json'),
  args = process.argv.slice(2),
  jsonPackage = require('../package.json'),
  fs = require('fs'),
  repoInfo = /\/\/[^\/]*\/([^\/]*)\/([^\/]*).git/g.exec(jsonPackage.repository.url),
  owner = repoInfo[1],
  repo = repoInfo[2],
  Publisher = require('./lib/publisher/publisher'),
  tag = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : null,
  draft = args.includes('--draft'),
  prerelease = args.includes('--prerelease'),
  publisher = new Publisher(owner, repo, tag),
  ghToken = args.includes('--gh-token') ? args[args.indexOf('--gh-token') + 1] : null

fs.readFile('./CHANGELOG.md.tmp', 'utf8', (err, changelog) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }

  publisher.publish(changelog, draft, prerelease, ghToken)
    .then(res => {
      console.log(`\x1b[32mSuccessfully published: ${res.html_url}\x1b[0m`)
    })
    .catch(err => {
      console.error(`\x1b[31mAn error occured: ${err.message}\x1b[0m`)
      process.exit(1)
    })
})
