const config = require('../../config');

function formatIssues (owner, repo, issues) {
  let s = issues.length > 0 ? '------ resolve' : '';

  issues.forEach(i => {
    if (!i.repo) {
      // Internal issue to the current repository
      s += ` [#${i.id}](${config.github.url}/${owner}/${repo}/issues/${i.id})`;
    } else {
      // External issue
      s += ` [${i.repo}#${i.id}](${config.github.url}/${i.repo}/issues/${i.id})`;
    }
  });
  return s;
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

function sortByLabel (prs) {
  let sortedPrs = {};

  for (const label of config.labels.priority) {
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
  constructor(owner, repo, currentVersion, ghToken) {
    this.owner = owner;
    this.repo = repo;
    this.currentVersion = currentVersion;
    this.ghToken = ghToken;
  }

  generate(prs, tag) {
    const
      date = new Date(),
      month = date.getMonth() + 1;
    const _prs = sortByLabel(groupByLabel(prs));

    let changeLog = `# [${tag}](${config.github.url}/${this.owner}/${this.repo}/releases/tag/${tag}) (${date.getFullYear()}-${(month < 10 ? '0' + month : month)}-${date.getDate()})\n\n`;

    for (const label of Object.keys(_prs)) {

      changeLog += `\n#### ${label}\n\n`;

      for (const pr of _prs[label]) {
        let ids = `[#${pr.id}](${pr.url})`;

        if (pr.complement) {
          pr.complement.forEach(c => {
            ids += `, [#${c.id}](${c.url})`;
          });
        }

        changeLog += `- [ ${ids} ] ${pr.title}  ${formatIssues(this.owner, this.repo, pr.issues)} ([${pr.author.login}](${pr.author.url}))\n`;
      }
    }

    changeLog += '---\n\n';

    return changeLog;
  }
};
