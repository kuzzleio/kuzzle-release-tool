const
  fs = require('fs'),
  getRepoInfo = require('./lib/get-repo-info'),
  Publisher = require('./lib/publisher/publisher');

// arguments parsing
const
  args = process.argv.slice(2),
  tag = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : null,
  draft = args.includes('--draft'),
  prerelease = args.includes('--prerelease'),
  ghToken = args.includes('--gh-token') ? args[args.indexOf('--gh-token') + 1] : null,
  projectPath = args.includes('--project-path') ? args[args.indexOf('--project-path') + 1] : null;

if (args.includes('--help')) {
  help();
  process.exit(1);
}

if (!projectPath || !tag || !ghToken) {
  help();
  console.error('\x1b[31mRequired argument missing\x1b[0m');
  process.exit(1);
}

getRepoInfo(projectPath)
  .then(info => {
    const 
      {owner, repo} = info,
      changelogFile = `${owner}.${repo}.CHANGELOG.md`;

    try {
      fs.accessSync(changelogFile, fs.constants.R_OK);
    }
    catch (error) {
      return Promise.reject(new Error(`Aborting: no changelog found for project ${owner}/${repo}`));
    }

    fs.readFile(changelogFile, 'utf8', (err, changelog) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }

      const publisher = new Publisher(owner, repo, tag, ghToken);

      publisher.publish(changelog, draft, prerelease)
        .then(res => {
          console.log(`\x1b[32mSuccessfully published: ${res.html_url}\x1b[0m`);
        })
        .catch(err2 => {
          console.error(`\x1b[31mAn error occured: ${err2.message}\x1b[0m`);
          process.exit(1);
        });
    });
  })
  .catch(error => {
    const message = error instanceof Error ? error.message : error;
    console.error(`\x1b[31m${message}\x1b[0m`);
    process.exit(1);
  });

function help () {
  console.log('usage:');
  console.log('       --tag           Tag to release');
  console.log('       --gh-token      Your github token');
  console.log('       --project-path  Path of the project to release');
  console.log('\noptional:');
  console.log('       --help          Show this help');
  console.log('       --draft         Draft the tag in github instead of releasing it');
  console.log('       --prerelease    Mark the tag as a prerelease version');
}
