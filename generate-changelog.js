const exec = require('child_process').exec;
const prependFile = require('prepend-file');
const https = require('https');
const bluebird = require('bluebird');

const issueRegex = /(resolve[s|d]?|close[s|d]?|fixe?[s|d]?) #([0-9]+)/g;
const command_fromTag = "bash -c 'git describe --abbrev=0 --tags'";

let
  labelPriority = [
    'breaking-change',
    'enhancement',
    'bug-fix',
    'optimisation',
    'refactor',
    'tests',
    'continuous-integration'
  ];

let
  args = process.argv.slice(2),
  _futureTag = require('../package.json').version,
  _changelogFile,
  _ghRepo,
  _ghToken,
  _toTag,
  _fromTag;

if (args.includes('--gh-token')) {
  _ghToken = args[args.indexOf('--gh-token') + 1];
}
else {
  console.error('argument missing: --gh-token <token>');
  process.exit(1);
}

if (args.includes('--gh-repo')) {
  _ghRepo = args[args.indexOf('--gh-repo') + 1];
}
else {
  console.error('argument missing: --gh-repo <repo>');
  process.exit(1);
}
if (args.includes('--changelog-file')) {
  _changelogFile = args[args.indexOf('--changelog-file') + 1];
}


if (args.includes('--from')) {
  _fromTag = args[args.indexOf('--from') + 1];
}
if (args.includes('--to')) {
  _toTag = args[args.indexOf('--to') + 1];
}
if (args.includes('--tag')) {
  _futureTag = args[args.indexOf('--tag') + 1];
}

function getSourceTagFromGit() {
  return new bluebird((resolve, reject) => {
    exec(command_fromTag, function (error, stdout) {
      if (error) {
        reject(error);
        return;
      }

      resolve(stdout.split('\n').filter(v => v)[0]);
    });
  })
}

function getPrIdsFromGit(fromTag, toTag) {
  let command_prIds = `git log --merges --format=oneline ${fromTag}...${toTag} |grep \"pull request\" | awk '{print $5}'`

  return new bluebird((resolve, reject) => {
    exec(command_prIds, function (error, stdout) {
      if (error) {
        reject(error);
        return;
      }

      resolve(stdout.replace(/#/g, '').split('\n').filter(v => v));
    });
  })
}

function getPrInfos(prId, ghRepo, ghToken) {
  return new bluebird((resolve, reject) => {
    let request = https.get({
      headers: {
        'user-agent': 'ci-changelog'
      },
      host: 'api.github.com',
      path: '/repos/' + ghRepo + '/issues/' + prId + '?access_token=' + ghToken
    }, response => {
      // Continuously update stream with data
      let body = '';

      response.on('error', e => reject(e));
      response.on('data', d => body += d);

      response.on('end', () => {
        let prInfos = JSON.parse(body);
        let labels = [];

        if (prInfos.labels) {
          labels = prInfos.labels
            .map(e => e.name)
            .filter(e => e[0] === ':')
            .map(e => e.replace(':', ''));
        }

        if (labels.length > 0) {
          let m;
          let issues = [];

          while ((m = issueRegex.exec(prInfos.body)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === issueRegex.lastIndex) {
              issueRegex.lastIndex++;
            }

            issues.push(m[2]);
          }

          resolve({
            labels,
            id: prId,
            title: prInfos.title.charAt(0).toUpperCase() + prInfos.title.slice(1),
            issues
          });

          return;
        }

        resolve(false);
      });
    });

    request.on('error', e => reject(e));
  })
}

function generateChangelog(changes, futureTag, fromTag, toTag, changelogFile) {
  let labels = {};
  let changelogLabels = {};
  let changelog = '';

  for (let change of changes) {
    if (change === false) continue;

    for (let label of change.labels) {
      if (!labels.hasOwnProperty(label)) {
        labels[label] = [];
      }

      labels[label].push(change);
    }
  }


  for (let label in labels) {
    let
      formatedLabel = label.charAt(0).toUpperCase() + label.slice(1);
    formatedLabel = formatedLabel.replace('-', ' ');

    changelogLabels[label] = `##### ${formatedLabel}\n`;

    for (let change of labels[label]) {

      changelogLabels[label] += `- [ [#${change.id}](https://github.com/stafyniaksacha/is-really-primitive/pull/${change.id}) ] ${change.title}`;

      if (change.issues.length > 0) {
        changelogLabels[label] += ` - (`;
        for (let issue of change.issues) {
          changelogLabels[label] += `[resolve #${issue}](https://github.com/stafyniaksacha/is-really-primitive/issue/${issue}), `;
        }
        changelogLabels[label] = changelogLabels[label].substring(0, changelogLabels[label].length - 2)
        changelogLabels[label] += `)`;
      }

      changelogLabels[label] += `\n\n`;
    }
  }

  if (changes.length > 0) {
    changelog += `### Release ${futureTag}\n`

    for (let label of labelPriority) {
      if (changelogLabels.hasOwnProperty(label)) {
        changelog += changelogLabels[label]
      }
    }

    changelog += `---\n\n`;
  }

  console.log('changelog version: %s...%s (future tag: %s)', fromTag, toTag, futureTag);
  console.log(changelog);

  if (changelogFile) {
    console.log('saving to file: %s', changelogFile);
    prependFile(changelogFile, changelog, 'utf8')
  }
}


getSourceTagFromGit()
  .then(sourceTag => {
    _fromTag = _fromTag || sourceTag
    return getPrIdsFromGit(_fromTag, _toTag || 'HEAD')
  })
  .then(prIds => {
    let promises = [];

    for (let prId of prIds) {
      promises.push(getPrInfos(prId, _ghRepo, _ghToken));
    }

    return bluebird.all(promises)
      .then(changes => generateChangelog(changes, _futureTag, _fromTag, _toTag || 'HEAD', _changelogFile));
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
