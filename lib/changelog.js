const
  Bluebird = require('bluebird'),
  semver = require('semver'),
  https = require('https'),
  { exec } = require('child_process'),
  config = require('../config.json'),
  ask = require('./ask');

const issueRegex = /(resolve[s|d]?|close[s|d]?|fix[?:es|ed]) (.*)\/?(.*)#([0-9]+)/g;

module.exports = class Changelog {
  constructor(dir, token, versionInfo, repoInfo, packageInfo) {
    this.vinfo = versionInfo;
    this.repo = repoInfo.repo;
    this.owner = repoInfo.owner;
    this.currentVersion = packageInfo.version;
    this.dir = dir;
    this.token = token;
    this.text = '';
    this.tag = '';
  }

  async generate() {
    const
      date = new Date(),
      day = String(date.getDate()).padStart(2, '0'),
      month = String(date.getMonth() + 1).padStart(2, '0'),
      rawPRs = await this._getPRs(),
      prs = this._sortByLabel(this._groupByLabel(rawPRs));

    this.tag = await this._generateNewTag(rawPRs);
    this.text = `# [${this.tag}](${config.github.url}/${this.owner}/${this.repo}/releases/tag/${this.tag}) (${date.getFullYear()}-${month}-${day})\n\n`;

    for (const label of Object.keys(prs)) {
      this.text += `\n#### ${label}\n\n`;

      for (const pr of prs[label]) {
        let ids = `[#${pr.id}](${pr.url})`;

        if (pr.complement) {
          pr.complement.forEach(c => {
            ids += `, [#${c.id}](${c.url})`;
          });
        }

        this.text += `- [ ${ids} ] ${pr.title}  ${this._formatIssues(pr.issues)} ([${pr.author.login}](${pr.author.url}))\n`;
      }
    }

    this.text += '---\n\n';
  }

  _getPRs() {
    return new Promise((resolve, reject) => {
      exec(`cd ${this.dir} && git fetch ; git log --abbrev-commit origin/${this.vinfo.release}..origin/${this.vinfo.development}`, (error, stdout) => {
        if (error) {
          return reject(error);
        }

        resolve(Bluebird.map(stdout.split('\n'), pr => {
          // Merge commits
          if (pr.indexOf('Merge pull request') !== -1) {
            return this._readFromGithub(pr.replace(/.*#([0-9]+).*/, '$1'));
          }

          // Fast-forwards
          if (pr.indexOf('(#') !== -1) {
            return this._readFromGithub(pr.replace(/.*\(#([0-9]+).*/, '$1'));
          }

          return null;
        })
          .then(result => result.filter(pr => pr !== null)));
      });
    });
  }

  async _generateNewTag(prs) {
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

    const tag = semver.inc(this.currentVersion, releaseType);

    console.log(`\x1b[32mNew repository tag: ${tag}\x1b[0m`);
    return tag;
  }

  _sortByLabel (prs) {
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

  _groupByLabel (prs) {
    const parts = {};

    for (const pr of prs) {
      if (pr.labels.includes(config.labels.exclude)) {
        continue;
      }

      // if no label, put in default one
      if (pr.labels.length === 0) {
        if (!parts[config.labels.default]) {
          parts[config.labels.default] = [];
        }
        parts[config.labels.default].push(pr);
      } else {
        // Complements
        if (pr.body) {
          prs.filter(p => p).map(p => {
            if (Number.parseInt(p.id) === Number.parseInt(pr.body.replace('complements #', ''))) {
              if (!p.complement) {
                p.complement = [];
              }
              p.complement.push({id: pr.id, url: pr.url});
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
      }
    }

    return parts;
  }

  _formatIssues (issues) {
    let s = issues.length > 0 ? '------ resolve' : '';

    issues.forEach(i => {
      if (!i.repo) {
        // Internal issue to the current repository
        s += ` [#${i.id}](${config.github.url}/${this.owner}/${this.repo}/issues/${i.id})`;
      } else {
        // External issue
        s += ` [${i.repo}#${i.id}](${config.github.url}/${i.repo}/issues/${i.id})`;
      }
    });
    return s;
  }

  _readFromGithub(id) {
    return new Promise((resolve, reject) => {
      https.get({
        headers: {
          'user-agent': 'ci-changelog'
        },
        host: config.github.api,
        path: `/repos/${this.owner}/${this.repo}/issues/${id}?access_token=${this.token}`
      }, response => {
        let str = '';

        response.on('data', chunk => {
          str += chunk;
        });

        response.on('end', () => {
          let res;

          try {
            res = JSON.parse(str);
          } catch(err) {
            return reject(err);
          }

          if (res.message) {
            return reject(res.message);
          }

          resolve(filterInfos(id, res));
        });

      }).on('error', e => reject(e));
    });
  }
};

function filterInfos (id, infos) {
  if (!infos) {
    return null;
  }

  let labels = [];

  if (infos.labels) {
    labels = infos.labels.map(e => e.name);
  }

  if (labels.length >= 0) {
    let m,
      issues = [];

    while ((m = issueRegex.exec(infos.body)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === issueRegex.lastIndex) {
        issueRegex.lastIndex++;
      }

      issues.push({repo: m[2], id: m[4]});
    }

    return {
      labels,
      id,
      title: infos.title.charAt(0).toUpperCase() + infos.title.slice(1),
      issues,
      url: infos.html_url,
      author: {
        login: infos.user.login,
        url: infos.user.html_url
      },
      body: (labels.includes(config.labels.complements) ? infos.body : null)
    };
  }
}
