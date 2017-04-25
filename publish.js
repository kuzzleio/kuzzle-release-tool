const
  args = process.argv.slice(2)
  fs = require('fs'),
  Publisher = require('./lib/publisher/publisher'),
  tag = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : null,
  draft = args.includes('--draft'),
  prerelease = args.includes('--prerelease'),
  ghToken = args.includes('--gh-token') ? args[args.indexOf('--gh-token') + 1] : null,
  projectPath = args.includes('--project-path') ? args[args.indexOf('--project-path') + 1] : null,
  publisher = new Publisher(owner, repo, tag, ghToken),
  jsonPackage = require(`${projectPath}/package.json`),
  repoInfo = /\/\/[^\/]*\/([^\/]*)\/([^\/]*).git/g.exec(jsonPackage.repository.url),
  owner = repoInfo[1],
  repo = repoInfo[2]

  fs.readFile('./CHANGELOG.md.tmp', 'utf8', (err, changelog) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }

  publisher.publish(changelog, draft, prerelease)
    .then(res => {
      console.log(`\x1b[32mSuccessfully published: ${res.html_url}\x1b[0m`)
    })
    .catch(err2 => {
      console.error(`\x1b[31mAn error occured: ${err2.message}\x1b[0m`)
      process.exit(1)
    })
})
