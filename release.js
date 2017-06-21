const 
  exec = require('child_process').exec,
  prependFile = require('prepend-file'),
  Reader = require('./lib/changelog-gen/reader'),
  Generator = require('./lib/changelog-gen/generator'),
  Branch = require('./lib/release-mgr/branch'),
  prerequisite = require('./lib/prerequisite'),
  TestEnvironment = require('./lib/release-mgr/test-env'),
  bumper = require('./lib/release-mgr/bumper'),
  PullRequest = require('./lib/release-mgr/pull-request'),
  compat = require('./compat.json'),
  ask = require('./lib/ask'),
  crypto = require('crypto'),
  fs = require('fs');

if (args.includes('--help')) {
  help();
  process.exit(1);
}

const
  args = process.argv.slice(2),
  envTestBranchName = crypto.createHmac('sha256', Math.random().toString()).digest('hex'),
  ghToken = args.includes('--gh-token') ? args[args.indexOf('--gh-token') + 1] : null,
  toTag = args.includes('--to') ? args[args.indexOf('--to') + 1] : null,
  fromTag = args.includes('--from') ? args[args.indexOf('--from') + 1] : null,
  tag = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : null,
  outputFile = args.includes('--output') ? args[args.indexOf('--output') + 1] : null,
  noCleanup = args.includes('--no-cleanup'),
  projectPath = args.includes('--project-path') ? args[args.indexOf('--project-path') + 1] : null;

if (!tag || !toTag || !fromTag || !ghToken || !projectPath) {
  help();
  process.exit(1);
}

const jsonPackage = require(`${projectPath}/package.json`);
let owner, repo;

if (args.includes('--dry-run')) {
  getRepoInfo()
    .then(info => {
      [repo, owner] = info;

      return dryRun();
    })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  run();
}

function help () {
  console.log('usage:');
  console.log('       --from         The git tag you want to start the release from');
  console.log('       --to           The git tag you want to stop the release to');
  console.log('       --tag          Tag to release');
  console.log('       --gh-token     Your github token');
  console.log('       --project-path Path of the project to release');
  console.log('\noptional:');
  console.log('       --help         Show this help');
  console.log('       --dry-run      Generate changelog and run tests but do not release');
  console.log('       --output       Changelog file (stdout will be used if this option is not set)');
  console.log('       --no-cleanup   Do not delete local and remote branches if the script fails');
}

function dryRun () {
  const
    branch = new Branch(tag, projectPath),
    testEnv = new TestEnvironment(owner, repo, envTestBranchName, ghToken);

  return prerequisite.hasTestEnv()
    .then(() => branch.getCurrent())
    .then(currentBranch => ask(`You are about to make a release based on branch ${currentBranch}with compat.json: \x1b[33m${JSON.stringify(compat, null, 2)}\x1b[0m\nPlease confirm (Y|n) `))
    .then(() => testEnv.reviewTravisYml())
    .then(() => testEnv.writeMatrix())
    .then(() => makeChangelog())
    .catch(err => {
      if (err) {
        console.error(`\x1b[31m${err}\x1b[0m`);
      }
      if (!noCleanup) {
        // Clean up
        testEnv.deleteProposalBranch(envTestBranchName);
        branch.delete(`${tag}`);
      }
    });
}

function writeChangelog (changeLog, file) {
  return new Promise((resolve, reject) => {
    prependFile(file, changeLog, 'utf8', err => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

function makeChangelog () {
  return new Promise((resolve, reject) => {
    exec(`cd ${projectPath} && git fetch ; git log --abbrev-commit origin/${toTag}..origin/${fromTag} | grep "pull request" | awk '{gsub(/#/, ""); print $4}'`, (error, stdout) => {
      if (error) {
        console.error(error);
        return;
      }

      let prs = stdout.split('\n');
      let promises = [];
      const generator = new Generator(owner, repo, tag, ghToken),
        reader = new Reader(owner, repo, ghToken);

      prs.forEach(id => {
        if (id) {
          promises.push(reader.readFromGithub(id));
        }
      });

      Promise.all(promises)
        .then(result => generator.generate(jsonPackage.version, result))
        .then(changeLog => {
          fs.writeFile('./CHANGELOG.md.tmp', changeLog, err => {
            if (err) {
              return reject(err);
            }
            if (outputFile) {
              return writeChangelog(changeLog, outputFile)
                .then(() => resolve(changeLog));
            }
            console.log(`\x1b[33m${changeLog}\x1b[0m`);
            resolve(changeLog);
          });
        })
        .catch(err => {
          if (err) {
            console.error(err);
          }
          reject();
        });
    });
  });
}

function runTest (branch, testEnv) {
  let changelog,
    sha,
    travisBuild,
    buildId;

  const
    pr = new PullRequest(owner, repo, tag, ghToken);

  return branch.getCurrent()
    .then(currentBranch => ask(`You are about to make a release based on branch ${currentBranch}with compat.json: \x1b[33m${JSON.stringify(compat, null, 2)}\x1b[0m\nAre you sure you want to release? (Y|n) `))
    .then(() => testEnv.reviewTravisYml())
    .then(() => testEnv.createProposalBranch(envTestBranchName))
    .then(() => testEnv.writeMatrix())
    .then(() => testEnv.pushProposalBranch(envTestBranchName))
    .then(() => branch.create(tag))
    .then(() => makeChangelog())
    .then((changes) => {
      changelog = changes;

      return bumper.bumpVersion(tag, jsonPackage, `${projectPath}/package.json`);
    })
    .then(() => branch.push(tag))
    .then(() => pr.create(changelog))
    .then(issue => {
      sha = issue.head.sha;

      return pr.updateLabels(issue.number);
    })
    .then(() => testEnv.getBuildNumber(envTestBranchName))
    .then(build => {
      travisBuild = build.replace('\n', '');

      return testEnv.getTravisBuildId(envTestBranchName);
    })
    .then(id => {
      buildId = id;

      return pr.updateStatus(sha, 'pending', buildId);
    })
    .then(() => testEnv.streamLog(travisBuild))
    .then(res => pr.updateStatus(sha, res.status, buildId));
}

function run () {
  // Let's run everything
  prerequisite.hasTestEnv()
    .then(() => {
      const
        branch = new Branch(tag, projectPath),
        testEnv = new TestEnvironment(owner, repo, envTestBranchName, ghToken);

      runTest(branch, testEnv)
        .then(() => process.exit(0))
        .catch(err => {
          if (err) {
            console.error(`\x1b[31m${err}\x1b[0m`);
          }
          if (!noCleanup) {
            // Clean up
            testEnv.deleteProposalBranch(envTestBranchName);
            branch.delete(`${tag}`);
          }
        });
    })
    .catch(() => {
      console.error('You must clone kuzzle-release-tool into this repo. git submodule update --recursive');
    });
}

function getRepoInfo () {
  return new Promise((resolve, reject) => {
    exec(`cd ${projectPath} && git remote get-url origin`, (error, stdout) => {
      if (error) {
        return reject(error);
      }

      const parsed = /^.*:(.*?)\/(.*?)\.git$/.exec(stdout.trim());

      if (parsed === null) {
        return reject(new Error(`Unable to parse the following GIT URL: ${stdout.trim()}\nMake sure the project git remote URL is set`));
      }

      resolve([parsed[1], parsed[2]]);
    });
  });
}
