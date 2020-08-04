const fs = require('fs');

const find = require('fast-glob');
const yargs = require('yargs');
const yaml = require('yaml');

const Branch = require('./lib/release-mgr/branch');
const bumpVersion = require('./lib/release-mgr/bumper');
const changeDocTags = require('./lib/release-mgr/doc-tag');
const PullRequest = require('./lib/release-mgr/pull-request');
const getRepoInfo = require('./lib/get-repo-info');
const config = require('./config');
const Changelog = require('./lib/changelog');
const repositories = require('./repositories');

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
      describe: 'Do not delete local and remote branches if the script fails',
      type: 'boolean',
      group: 'Optional'
    },
    'dry-run': {
      describe: 'Generates the changelog, but does not push anything to github',
      type: 'boolean',
      group: 'Optional'
    },
    'tag': {
      describe: 'Force the release tag with the provided value, instead of calculating it',
      type: 'string',
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

run();

/*
 * End of main file code
 *
 * Beyond this point, there should be
 * only functions declaration
 */
async function run() {
  try {
    const repoInfo = await getRepoInfo(dir);

    if (!repositories[repoInfo.repo]) {
      throw new Error(`Unknown repository ${repoInfo.repo}. Please update the repositories.json file.`);
    }

    const versionInfo = repositories[repoInfo.repo].find(v => v.version === args.major);

    if (versionInfo === undefined) {
      throw new Error(`Unknown major version "${args.major}"" for repository ${repoInfo.repo}. Verify the repositories.json file.`);
    }

    const packageInfo = await getProjectInfo(versionInfo);

    const changelog = new Changelog(dir, args.token, versionInfo, repoInfo, packageInfo);

    if (args.tag) {
      changelog.forceTag(args.tag);
    }

    await changelog.generate();

    await writeChangelogToFile(changelog);

    if (args.dryRun) {
      console.log('Dry run ended successfully.');
      return;
    }

    await release(packageInfo, changelog);
  }
  catch(error) {
    if (error) {
      const message = error instanceof Error ? error.stack : error;
      console.error(`\x1b[31m${message}\x1b[0m`);
    } else {
      console.log('Goodbye.');
    }

    process.exit(Number(error !== undefined));
  }
}

function writeChangelogToFile(changelog) {
  if (!config.changelogDir) {
    throw new Error('No changelog directory configured. Please set a "changelogDir" property in the JSON configuration file');
  }

  try {
    fs.mkdirSync(config.changelogDir);
  }
  catch (e) {
    // directory already exists: do nothing
  }

  const
    disclaimer = '[comment]: # (THIS FILE IS PURELY INFORMATIONAL, IT IS NOT USED IN THE RELEASE PROCESS)\n\n',
    changelogFile = `${config.changelogDir}/${changelog.owner}.${changelog.repo}.${args.major}.CHANGELOG.md`;

  return new Promise((resolve, reject) => {
    fs.writeFile(changelogFile, disclaimer + changelog.text, 'utf8', err => {
      if (err) {
        return reject(err);
      }

      console.log(`\x1b[33mCHANGELOG written in ${changelogFile}\x1b[0m`);
      resolve();
    });

    return null;
  });
}

async function release (packageInfo, changelog) {
  const branch = new Branch(dir, changelog.tag);

  await branch.checkout(changelog.vinfo.development);

  try {
    await branch.create(changelog.tag);
    await bumpVersion(dir, packageInfo, changelog.tag);
    await changeDocTags(dir, changelog.tag);

    await branch.push();

    const pr = new PullRequest(changelog.owner, changelog.repo, changelog.tag, args.token, changelog.vinfo.release);
    const issue = await pr.create(changelog.text);
    await pr.updateLabels(issue.number);
  } catch(err) {
    if (!args.noCleanup && err !== undefined) {
      // Clean up
      console.error('\x1b[31mAn error occured: cleaning up.\x1b[0m');
      branch.delete(changelog.tag);
    }

    throw err;
  }
}

/**
 * Detects the project information file, parse it and return
 * relevant informations
 *
 * @return {object}
 */
async function getProjectInfo (vinfo) {
  const files = [
    {name: 'pubspec.yaml', type: 'dart'},
    {name: 'composer.json', type: 'json'},
    {name: 'build.gradle', type: 'gradle'},
    // kotlin scripts aren't in gradle format, but the version number is
    // encoded the exact same way
    {name: 'build.gradle.kts', type: 'gradle'},
    {name: '**/*.nuspec', type: 'nuget'},
    // some non-node projects contain a package.json to build the documentation,
    // so we should always check this file last
    {name: 'package.json', type: 'json'},
  ];

  const branch = new Branch(dir, vinfo.development);

  await branch.checkout(vinfo.development);

  for (const file of files) {
    const entries = find.sync(file.name, {
      cwd: dir,
      onlyFiles: true,
      absolute: true,
    });

    if (entries.length === 0) {
      continue;
    }
    else if (entries.length > 1) {
      throw new Error(`Error: found too many project files (type: ${file.type}, found: ${entries})`);
    }

    let version;
    let content;

    if (file.type === 'json') {
      content = require(entries[0]);
      version = content.version;
    }
    else {
      try {
        content = fs.readFileSync(entries[0], 'utf8');
      }
      catch (error) {
        throw new Error(`${file.type} project detected, but an error occured while attempting to read ${file.name}:\n${error.message}`);
      }

      if (file.type === 'gradle') {
        version = content
          .split('\n')
          .filter(line => line.match(/^version\s*=\s*"/))
          .map(line => line.replace(/^version\s*=\s*"(.*?)"/, '$1'))[0];
      }
      else if (file.type === 'nuget') {
        version = content
          .split('\n')
          .filter(line => line.match(/<version>(.*?)<\/version>/))
          .map(line => line.replace(/.*<version>(.*?)<\/version>.*/, '$1'))[0];
      }
      else if (file.type === 'dart') {
        content = yaml.parse(content);
        version = content.version;
      }
    }

    return {
      version,
      content,
      type: file.type,
      name: file.name,
      path: entries[0]
    };
  }

  throw new Error(`No project file found in ${dir}`);
}
