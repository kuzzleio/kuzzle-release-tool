const
  yargs = require('yargs'),
  rp = require('request-promise'),
  ask = require('./lib/ask'),
  getRepoInfo = require('./lib/get-repo-info'),
  Publisher = require('./lib/publisher/publisher'),
  repositories = require('./repositories'),
  config = require('./config');

// arguments parsing
const args = yargs
  .usage('USAGE: $0 -t <token> -m <major> <project directory>')
  .options({
    major: {
      alias: 'm',
      demandOption: true,
      type: 'number',
      describe: 'The project\'s major version to be published'
    },
    token: {
      alias: 't',
      demandOption: true,
      type: 'string',
      describe: 'Github auth token'
    },
    draft: {
      type: 'boolean',
      describe: 'Draft the new release in Github, without publishing it'
    },
    prerelease: {
      type: 'boolean',
      describe: 'Flag the new tag as a prerelease'
    }
  })
  .strict(true)
  .parse();

if (args._.length !== 1) {
  yargs.showHelp();
  console.error('A project directory must be provided');
  process.exit(1);
}

const projectPath = args._[0];

run();

async function run() {
  try {
    const info = await getRepoInfo(projectPath);
    const versionInfo = repositories[info.repo].find(v => v.version === args.major);

    if (versionInfo === undefined) {
      throw new Error(`Unknown major version "${args.major}"" for repository ${info.repo}. Verify the repositories.json file.`);
    }

    const pr = await getLatestRelease(info.owner, info.repo, versionInfo.release);
    const tag = (pr.body.match(new RegExp(`\\(https://github.com/${info.owner}/${info.repo}/releases/tag/(.*?)\\)`)))[1];

    const answer = await ask(`Detected tag: ${tag}. Is that correct (Y|n)? `);

    if (!answer) {
      throw new Error('Abort.');
    }

    const publisher = new Publisher(info.owner, info.repo, tag, args.token, versionInfo.release);

    const result = await publisher.publish(pr.body, args.draft, args.prerelease);
    console.log(`\x1b[32mSuccessfully published: ${result.html_url}\x1b[0m`);
  }
  catch(error) {
    const message = error instanceof Error ? error.message : error;
    console.error(`\x1b[31m${message}\x1b[0m`);
    process.exit(1);
  }
}

async function getLatestRelease(owner, repo, releaseBranch) {
  const result = await rp({
    uri: `https://${config.github.api}/search/issues?q=base:${releaseBranch}+repo:${owner}/${repo}+label:release+is:merged&access_token=${args.token}&sort=updated&order=desc`,
    method: 'GET',
    headers: {
      'user-agent': 'ci-changelog'
    },
    json: true
  });

  if (result.total_count === 0) {
    throw new Error('No release found. Abort.');
  }

  return result.items[0];
}
