const
  yargs = require('yargs'),
  semver = require('semver'),
  exec = require('child_process').exec,
  Reader = require('./lib/changelog-gen/reader'),
  Generator = require('./lib/changelog-gen/generator'),
  Branch = require('./lib/release-mgr/branch'),
  bumpVersion = require('./lib/release-mgr/bumper'),
  PullRequest = require('./lib/release-mgr/pull-request'),
  ask = require('./lib/ask'),
  fs = require('fs'),
  getRepoInfo = require('./lib/get-repo-info'),
  config = require('./config'),
  repositories = require('./repositories');

const disclaimer = '[comment]: # (THIS FILE IS PURELY INFORMATIONAL, IT IS NOT USED IN THE RELEASE PROCESS)\n\n';

// arguments parsing
const args = yargs
  .options({
    major: {
      alias: 'm',
      describe: 'Repository version to release (see repositories.json)',
      demandOption: true,
      type: 'number',
      group: 'Required'
    },
    token: {
      alias: 't',
      describe: 'Github token',
      demandOption: true,
      type: 'string',
      group: 'Required'
    },
    'no-cleanup': {
      alias: 'n',
      describe: 'Do not delete local and remote branches if the script fails',
      type: 'boolean',
      group: 'Optional'
    },
    'dry-run': {
      alias: 'd',
      describe: 'Generates the changelog, but does not push anything to github',
      type: 'boolean',
      group: 'Optional'
    }
  })
  .strict(true)
  .usage('USAGE: $0 -m <major> -t <token> <project directory>')
  .parse();

if (args._.length !== 1) {
  yargs.showHelp();
  console.error('A repository directory must be provided');
  process.exit(1);
}

const dir = args._[0];

let owner, repo, packageInfo, versionInfo;

getProjectInfo()
  .then(info => {
    packageInfo = info;
    return getRepoInfo(dir);
  })
  .then(info => {
    ({owner, repo} = info);

    if (!repositories[repo]) {
      throw new Error(`Unknown repository ${repo}. Please update the repositories.json file.`);
    }

    versionInfo = repositories[repo].find(v => v.version === args.major);

    if (versionInfo === undefined) {
      throw new Error(`Unknown major version "${args.major}"" for repository ${repo}. Verify the repositories.json file.`);
    }

    return run(args.dryRun);
  })
  .then(() => process.exit(0))
  .catch(error => {
    if (error) {
      const message = error instanceof Error ? error.stack : error;
      console.error(`\x1b[31m${message}\x1b[0m`);
    }
    else {
      console.log('Goodbye.');
    }

    process.exit(Number(error !== undefined));
  });

/*
 * End of main file code
 *
 * Beyond this point, there should be
 * only functions declaration
 */

async function generateNewTag(prs) {
  let releaseType = 'patch';
  const breaking = [];

  for (const pr of prs) {
    for (const label of pr.labels) {
      if (label === 'changelog:breaking-changes') {
        breaking.push(pr);
      } else if (label === 'changelog:new-features') {
        releaseType = 'minor';
      }
    }
  }

  if (breaking.length > 0) {
    releaseType = 'major';
    console.log('\x1b[31m/!\\ This release contains breaking changes:\x1b[0m');

    breaking.forEach(pr => console.log(`  #${pr.id}: ${pr.title}`));

    console.log(`\x1b[31m
New major versions require manual actions, such as the creation of a new
target branch (usually named "<new major>-stable"), and adding that new
version to the "repositories.json" file at the root of this project.

Then a release can be performed using this tool, using the argument:
  -v <newly created version>
\x1b[0m`);
    const answer = await ask('Have these steps been performed (Y|n)? ');

    if (!answer) {
      console.log('\x1b[31mAbort.\x1b[0m');
      process.exit(1);
    }
  }

  const tag = semver.inc(packageInfo.version, releaseType);

  console.log(`\x1b[32mNew repository tag: ${tag}\x1b[0m`);
  return tag;
}

function makeChangelog () {
  if (!config.changelogDir) {
    throw new Error('No changelog directory configured. Please set a "changelogDir" property in the JSON configuration file');
  }

  try {
    fs.mkdirSync(config.changelogDir);
  }
  catch (e) {
    // directory already exists: do nothing
  }

  return new Promise((resolve, reject) => {
    exec(`cd ${dir} && git fetch ; git log --abbrev-commit origin/${versionInfo.release}..origin/${versionInfo.development}`, (error, stdout) => {
      if (error) {
        return reject(error);
      }

      const
        generator = new Generator(owner, repo, packageInfo.version, args.token),
        reader = new Reader(owner, repo, args.token);

      const promises = stdout
        .split('\n')
        .map(pr => {
          // Merge commits
          if (pr.indexOf('Merge pull request') !== -1) {
            return reader.readFromGithub(pr.replace(/.*#([0-9]+).*/, '$1'));
          }

          // Fast-forwards
          if (pr.indexOf('(#') !== -1) {
            return reader.readFromGithub(pr.replace(/.*\(#([0-9]+).*/, '$1'));
          }

          return null;
        })
        .filter(line => line);

      let tag, prs;

      Promise.all(promises)
        .then(_prs => {
          prs = _prs;
          return generateNewTag(prs, tag);
        })
        .then(_tag => {
          tag = _tag;
          return generator.generate(prs, tag);
        })
        .then(changelog => {
          const changelogFile = `${config.changelogDir}/${owner}.${repo}.${args.major}.CHANGELOG.md`;

          fs.writeFile(changelogFile, disclaimer + changelog, 'utf8', err => {
            if (err) {
              return reject(err);
            }

            console.log(`\x1b[33mCHANGELOG written in ${changelogFile}\x1b[0m`);
            resolve({tag, changelog});
          });

          return null;
        })
        .catch(err => reject(err));
    });
  });
}

function release (branch, changelog, tag) {
  const
    pr = new PullRequest(owner, repo, tag, args.token, versionInfo.release);

  return branch.create(tag)
    .then(() => bumpVersion(dir, packageInfo, tag))
    .then(() => branch.push(tag))
    .then(() => pr.create(changelog))
    .then(issue => pr.updateLabels(issue.number));
}

function run (dryRun) {
  const
    branch = new Branch(dir);

  // Let's run everything
  return branch.checkout(versionInfo.development)
    .then(() => makeChangelog())
    .then(result => {
      if (dryRun) {
        console.log('Dry run ended successfully.');
        return Promise.resolve();
      }

      return release(branch, result.changelog, result.tag);
    })
    .catch(err => {
      if (!args.noCleanup && err !== undefined) {
        // Clean up
        console.error('\x1b[31mAn error occured: cleaning up.\x1b[0m');
        branch.delete('foo');
      }

      return Promise.reject(err);
    });
}

/**
 * Detects the project information file, parse it and return
 * relevant informations
 *
 * @return {object}
 */
function getProjectInfo () {
  const files = [
    {name: 'package.json', type: 'json'},
    {name: 'composer.json', type: 'json'},
    {name: 'build.gradle', type: 'gradle'}
  ];

  return new Promise((resolve, reject) => {
    for (const file of files) {
      const fullpath = `${dir}/${file.name}`;

      try {
        fs.accessSync(fullpath, fs.constants.R_OK | fs.constants.W_OK);
      }
      catch(e) {
        // ignore exception and continue with next file check
        continue;
      }

      let version, content;

      if (file.type === 'json') {
        content = require(fullpath);
        version = content.version;
      }
      else {
        // for now, there is only gradle projects left
        // other cases might be added later
        try {
          content = fs.readFileSync(fullpath, 'utf8');
        }
        catch (error) {
          return reject(new Error(`${file.type} project detected, but an error occured while attempting to read ${file.name}:\n${error.message}`));
        }

        version = content
          .split('\n')
          .filter(line => line.match(/^version\s*=\s*"/))
          .map(line => line.replace(/^version\s*=\s*"(.*?)"/, '$1'))[0];
      }

      return resolve({
        version,
        content,
        type: file.type,
        name: file.name,
        path: fullpath
      });
    }

    reject(new Error(`No project file found in ${dir}`));
  });
}
