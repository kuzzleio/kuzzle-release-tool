const
  config = require('../../config.json'),
  ask = require('../ask');

let
  hasBreakingChanges = false;

function formatIssues (owner, repo, issues) {
  let s = issues.length > 0 ? '------ resolve' : '';

  issues.forEach(i => {
    if (!i.repo) {
      // Internal issue to the current repository
      s += ` [\#${i.id}](${config.github.url}/${owner}/${repo}/issues/${i.id})`;
    } else {
      // External issue
      s += ` [${i.repo}\#${i.id}](${config.github.url}/${i.repo}/issues/${i.id})`;
    }
  });
  return s;
}

function checkIfMajor (currentVersion, tag) {
  return currentVersion.split('.')[0] < tag.split('.')[0];
}

function groupByLabel (prs) {
  const parts = {};

  prs
    .filter(pr => !pr.labels.includes(config.labels.exclude))
    .forEach(pr => {
      // if no label, put in default one
      if (pr.labels.length === 0) {
        delete pr.labels;
        if (!parts[config.labels.default]) {
          parts[config.labels.default] = [];
        }
        parts[config.labels.default].push(pr);
      } else {
        if (pr.labels.includes(config.labels.breaking)) {
          hasBreakingChanges = true;
        }

        // Complements
        if (pr.body) {
          prs.map(p => {
            if (p) {
              if (parseInt(p.id) === parseInt(pr.body.replace('complements #', ''))) {
                if (!p.complement) {
                  p.complement = [];
                }
                p.complement.push({id: pr.id, url: pr.url});
              }
            }
          });
        }

        pr.labels = pr.labels
          .filter(label => label !== config.labels.complements);

        pr.labels
          .filter(label => label.indexOf('changelog:') > -1)
          .map(label => {
            let parsedLabel = label.replace('changelog:', '').replace('-', ' ');
            parsedLabel = parsedLabel.charAt(0).toUpperCase() + parsedLabel.slice(1);

            if (!parts[parsedLabel]) {
              parts[parsedLabel] = [];
            }
            parts[parsedLabel].push(pr);
          });

        // Others
        let hasChangelog = false;

        pr.labels.forEach(label => {
          if (label.indexOf('changelog:') > -1) {
            hasChangelog = true;
          }
        });

        if (!hasChangelog) {
          if (!parts[config.labels.default]) {
            parts[config.labels.default] = [];
          }
          parts[config.labels.default].push(pr);
        }
        delete pr.labels;
      }
    });

  return parts;
}

function verifyBreakingChange (currentVersion, tag) {
  if (hasBreakingChanges) {
    if (!checkIfMajor(currentVersion, tag)) {
      return ask(`Seems you have breaking changes but didn't specify a major version:\nCurrent version: ${currentVersion}\nNew version: ${tag}\nAre you sure you want to continue? (Y|n) `);
    }
    return Promise.resolve();
  }
  return Promise.resolve();
}

function sortByLabel (prs) {
  let sortedPrs = {};

  for (let label of config.labels.priority) {
    if (prs[label]) {
      sortedPrs[label] = prs[label];
      delete prs[label];
    }
  }

  Object.keys(prs).forEach(label => {
    sortedPrs[label] = prs[label];
  });

  return sortedPrs;
}

module.exports = class Generator {
  constructor(owner, repo, tag, ghToken) {
    this.owner = owner;
    this.repo = repo;
    this.tag = tag;
    this.ghToken = ghToken;
  }

  generate(currentVersion, prs) {
    const
      date = new Date(),
      month = date.getMonth() + 1;
    const _prs = sortByLabel(groupByLabel(prs));

    return verifyBreakingChange(currentVersion, this.tag)
      .then(() => {
        let changeLog = `# [${this.tag}](${config.github.url}/${this.owner}/${this.repo}/releases/tag/${this.tag}) (${date.getFullYear()}-${(month < 10 ? '0' + month : month)}-${date.getDate()})\n\n`;

        Object.keys(_prs).forEach(k => {
          changeLog += `\n#### ${k}\n\n`;

          for (const pr of _prs[k]) {
            let ids = `[\#${pr.id}](${pr.url})`;

            if (pr.complement) {
              pr.complement.forEach(c => {
                ids += `, [\#${c.id}](${c.url})`;
              });
            }
            
            changeLog += `- [ ${ids} ] ${pr.title}  ${formatIssues(this.owner, this.repo, pr.issues)} ([${pr.author.login}](${pr.author.url}))\n`;
          }
        });

        changeLog += '---\n\n';

        return changeLog;
      });
  }
};
