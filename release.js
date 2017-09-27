const 
  exec = require('child_process').exec,
  Reader = require('./lib/changelog-gen/reader'),
  Generator = require('./lib/changelog-gen/generator'),
  Branch = require('./lib/release-mgr/branch'),
  prerequisite = require('./lib/prerequisite'),
  TestEnvironment = require('./lib/release-mgr/test-env'),
  bumpVersion = require('./lib/release-mgr/bumper'),
  PullRequest = require('./lib/release-mgr/pull-request'),
  compat = require('./compat.json'),
  ask = require('./lib/ask'),
  crypto = require('crypto'),
  fs = require('fs'),
  getRepoInfo = require('./lib/get-repo-info'),
  config = require('./config.json');

// arguments parsing
const
  args = process.argv.slice(2),
  envTestBranchName = crypto.createHmac('sha256', Math.random().toString()).digest('hex'),
  ghToken = args.includes('--gh-token') ? args[args.indexOf('--gh-token') + 1] : null,
  toTag = args.includes('--to') ? args[args.indexOf('--to') + 1] : null,
  fromTag = args.includes('--from') ? args[args.indexOf('--from') + 1] : null,
  tag = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : null,
  noCleanup = args.includes('--no-cleanup'),
  projectPath = args.includes('--project-path') ? args[args.indexOf('--project-path') + 1] : null;

if (args.includes('--help')) {
  help();
  process.exit(0);
}

if (!tag || !toTag || !fromTag || !ghToken || !projectPath) {
  help();
  console.error('\x1b[31mRequired argument missing\x1b[0m');
  process.exit(1);
}

let owner, repo, packageInfo;

getProjectInfo()
  .then(info => {
    packageInfo = info;
    return getRepoInfo(projectPath);
  })
  .then(info => {
    ({owner, repo} = info);

    return run(args.includes('--dry-run'));
  })
  .then(() => process.exit(0))
  .catch(error => {
    const message = error instanceof Error ? error.message : error;
    console.error(`\x1b[31m${message}\x1b[0m`);
    process.exit(1);
  });

/*
 * End of main file code
 * 
 * Beyond this point, there should be
 * only functions declaration
 */

function help () {
  console.log('usage:');
  console.log('       --from         The git tag/branch you want to start the release from');
  console.log('       --to           The git tag/branch you want to stop the release to');
  console.log('       --tag          Tag to release');
  console.log('       --gh-token     Your github token');
  console.log('       --project-path Path of the project to release');
  console.log('\noptional:');
  console.log('       --help         Show this help');
  console.log('       --dry-run      Generate changelog and run tests but do not release');
  console.log('       --no-cleanup   Do not delete local and remote branches if the script fails');
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
    exec(`cd ${projectPath} && git fetch ; git log --abbrev-commit origin/${toTag}..origin/${fromTag} | grep "pull request" | awk '{gsub(/#/, ""); print $4}'`, (error, stdout) => {
      if (error) {
        return reject(error);
      }

      const 
        promises = [],
        generator = new Generator(owner, repo, tag, ghToken),
        reader = new Reader(owner, repo, ghToken);

      for (const id of stdout.split('\n')) {
        if (id) {
          promises.push(reader.readFromGithub(id));
        }
      }

      Promise.all(promises)
        .then(result => generator.generate(packageInfo.version, result))
        .then(changeLog => {
          const changelogFile = `${config.changelogDir}/${owner}.${repo}.CHANGELOG.md`;

          fs.writeFile(changelogFile, changeLog, 'utf8', err => {
            if (err) {
              return reject(err);
            }

            console.log(`\x1b[33mCHANGELOG written in ${changelogFile}\x1b[0m`);
            resolve(changeLog);
          });

          return null;
        })
        .catch(err => reject(err));
    });
  });
}

function release (branch, testEnv, changelog) {
  let 
    sha,
    travisBuild,
    buildId;

  const
    pr = new PullRequest(owner, repo, tag, ghToken);

  return branch.create(tag)
    .then(() => testEnv.createProposalBranch(envTestBranchName))
    .then(() => testEnv.pushProposalBranch(envTestBranchName))
    .then(() => bumpVersion(packageInfo, tag))
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

function run (dryRun) {
  const
    branch = new Branch(tag, projectPath),
    testEnv = new TestEnvironment(owner, repo, envTestBranchName, ghToken);

  // Let's run everything
  return prerequisite.hasTestEnv()
    .then(() => branch.getCurrent())
    .then(currentBranch => ask(`You are about to make a release based on branch ${currentBranch}with compat.json: \x1b[33m${JSON.stringify(compat, null, 2)}\x1b[0m\nAre you sure you want to release? (Y|n) `))
    .then(() => testEnv.reviewTravisYml())
    .then(() => testEnv.writeMatrix())
    .then(() => makeChangelog())
    .then(changelog => {
      if (dryRun) {
        console.log('Dry run ended successfully.');
        return Promise.resolve();
      }

      return release(branch, testEnv, changelog);
    })
    .catch(err => {
      if (!noCleanup) {
        // Clean up
        console.error('\x1b[31mAn error occured: cleaning up.\x1b[0m');
        testEnv.deleteProposalBranch(envTestBranchName);
        branch.delete(tag);
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
      const fullpath = `${projectPath}/${file.name}`;
      
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
          .filter(line => line.match(/^version\s*=\s*\"/))
          .map(line => line.replace(/^version\s*=\s*\"(.*?)\"/, '$1'))[0];
      }

      return resolve({
        version,
        content,
        type: file.type,
        name: file.name,
        path: fullpath
      });
    }

    reject(new Error(`No project file found in ${projectPath}`));
  });
}
