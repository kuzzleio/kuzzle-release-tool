const
  yargs = require('yargs'),
  rp = require('request-promise'),
  Bluebird = require('bluebird'),
  config = require('./config.json'),
  repositories = require('./repositories');

const maxRepoName = Object.keys(repositories).reduce((max, name) => Math.max(name.length, max), '');

// arguments parsing
const args = yargs
  .usage('USAGE: $0 --token <token>')
  .option('token', {
    alias: 't',
    demandOption: true,
    type: 'string',
    describe: 'Github auth token'
  })
  .strict(true)
  .parse();

run();

async function run() {
  let result;

  try {
    result = await Bluebird.map(Object.keys(repositories), detectChanges, {concurrency: config.github.concurrency});
  } catch(error) {
    console.error(`\x1b[31m${error.message}\x1b[0m`);
    console.error(`\x1b[31m${error.stack}\x1b[0m`);
    process.exit(1);
  }

  result = result.filter(r => r !== null);

  if (result.length > 0) {
    console.log('\x1b[32mThe following repositories can be released:\x1b[0m');

    for (const change of result) {
      console.log(`\x1b[32m\t${change.name.padEnd(maxRepoName)} => Versions: ${change.versions.join(',')}\x1b[0m`);
    }
  } else {
    console.log('\x1b[32mNothing to release.\x1b[0m');
  }
}

function apiRequest (url, querystring = {}) {
  const
    qs = Object.assign({access_token: args.token, per_page: 999}, querystring),
    uri = `https://${config.github.api}/${url}`,
    options = {
      qs,
      uri,
      json: true,
      headers: {
        'User-Agent': 'Request-Promise'
      }
    };

  return rp(options)
    .catch(error => {
      console.error(`\x1b[31mGithub API call failed on URL: ${uri}\x1b[0m`);
      throw error;
    });
}

async function getBranches(repo) {
  const response = await apiRequest(`repos/kuzzleio/${repo}/branches`);
  const branches = {};

  for (const branch of response) {
    branches[branch.name] = branch.commit.sha;
  }

  return branches;
}

async function getLastUpdate (repo, sha) {
  let response;

  try {
    response = await apiRequest(`repos/kuzzleio/${repo}/commits`, {sha});
  } catch(err) {
    if (err.statusCode === 409 && err.message.match('is empty') !== null) {
      return 0;
    }
    throw err;
  }

  let lastUpdate = 0;

  for (const commit of response) {
    const lu = new Date(commit.commit.committer.date);

    if (lastUpdate < lu) {
      lastUpdate = lu;
    }
  }

  return lastUpdate;
}

async function detectChanges(repo) {
  const
    devBranches = repositories[repo].map(branch => branch.development),
    releaseBranches = repositories[repo].map(branch => branch.release);

  console.log(`Scanning project ${repo}...`);

  const branches = await getBranches(repo);
  let missing = devBranches.filter(branch => !branches[branch]);

  if (missing.length > 0) {
    console.error(`\x1b[31m/!\\ [${repo}] Unknown development branches: ${missing.join(',')}\x1b[0m`);
    process.exit(1);
  }

  missing = repositories[repo]
    .map(branch => branch.release)
    .filter(branch => !branches[branch]);

  if (missing.length > 0) {
    console.error(`\x1b[31m/!\\ [${repo}] Unknown release branches: ${missing.join(',')}\x1b[0m`);
    process.exit(1);
  }

  const devBranchDates = await Bluebird.map(
    devBranches,
    devBranch => getLastUpdate(repo, branches[devBranch]),
    {concurrency: config.github.concurrency}
  );

  const releaseDates = await Bluebird.map(
    releaseBranches,
    releaseBranch => getLastUpdate(repo, branches[releaseBranch]),
    {concurrency: config.github.concurrency}
  );

  const toBeReleased = [];

  for(let i = 0; i < repositories[repo].length; i++) {
    if (releaseDates[i] < devBranchDates[i]) {
      toBeReleased.push(repositories[repo][i].version);
    }
  }

  if (toBeReleased.length > 0) {
    return {name: repo, versions: toBeReleased};
  }

  return null;
}
