const
  rp = require('request-promise'),
  minimatch = require('minimatch'),
  config = require('./config.json');

// arguments parsing
const
  args = process.argv.slice(2),
  user = args.includes('--user') ? args[args.indexOf('--user') + 1] : null,
  // Authentication token is required for better Github API rate limits
  // Rate limits on unauthenticated requests are too low for this tool
  token = args.includes('--gh-token') ? args[args.indexOf('--gh-token') + 1] : null;

if (args.includes('--help')) {
  help();
  process.exit(0);
}

if (!user || !token) {
  help();
  console.error('\x1b[31mRequired argument missing\x1b[0m');
  process.exit(1);
}

apiRequest(`orgs/${user}/repos`)
  .then(repos => {
    const promises = [];

    for (const repo of repos) {
      promises.push(detectChanges(repo.name));
    }

    return Promise.all(promises);
  })
  .catch(error => {
    console.error(`\x1b[31m${error.message}\x1b[0m`);
    process.exit(1);
  });


function help() {
  console.log('usage:');
  console.log('       --gh-token     Github auth token');
  console.log('       --user         The name of the github user owner to scan');
  console.log('\noptional:');
  console.log('       --help         Show this help');
}

function apiRequest (url, querystring = {}) {
  const 
    qs = Object.assign({access_token: token, per_page: 999}, querystring),
    uri = `http://${config.github.api}/${url}`,
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

function getBranches(repo) {
  return apiRequest(`repos/${user}/${repo}/branches`)
    .then(response => {
      const branches = {};

      for (const branch of response) {
        branches[branch.name] = branch.commit.sha;
      }
      
      return branches;
    });
}

function getLastUpdate (repo, sha) {
  return apiRequest(`repos/${user}/${repo}/commits`, {sha})
    .then(response => {
      let lastUpdate = 0;

      for (const commit of response) {
        const lu = new Date(commit.commit.committer.date);

        if (lastUpdate < lu) {
          lastUpdate = lu;
        }

        return lastUpdate;
      }
    });
}

function detectChanges(repo) {
  let 
    branches,
    devBranches,
    devBranchDates;

  console.log(`Scanning project ${repo}...`);

  return getBranches(repo)
    .then(response => {
      branches = response;

      devBranches = Object.keys(branches)
        .filter(name => minimatch(name, config.devBranchPattern));

      const promises = [];

      for (const devbranch of devBranches) {
        promises.push(getLastUpdate(repo, branches[devbranch]));
      }

      return Promise.all(promises);
    })
    .then(dates => {
      devBranchDates = dates;
      return getLastUpdate(repo, branches.master);
    })
    .then(masterDate => {
      let count = 0;

      for(let i = 0; i < devBranches.length; i++) {
        if (masterDate < devBranchDates[i]) {
          if (count === 0) {
            process.stdout.write(`===> ${repo} can be released from: `);
          }

          process.stdout.write(devBranches[i] + ' ');

          count++;
        }
      }

      if (count > 0) {
        process.stdout.write('\n');
      }

      if (count > 1) {
        console.error('\x1b[31m/!\\ master is behind multiple development branches\x1b[0m');
      }
    });
}
