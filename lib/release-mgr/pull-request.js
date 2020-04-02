const
  rp = require('request-promise'),
  config = require('../../config.json');

module.exports = class PullRequest {
  constructor(owner, repo, tag, ghToken, targetBranch) {
    this.owner = owner;
    this.repo = repo;
    this.tag = tag;
    this.ghToken = ghToken;
    this.targetBranch = targetBranch;
  }

  create(changelog) {
    return rp({
      uri: `https://${config.github.api}/repos/${this.owner}/${this.repo}/pulls`,
      method: 'POST',
      headers: {
        'user-agent': 'ci-changelog',
        'authorization': `token ${this.ghToken}`,
      },
      body: {
        title: `Release ${this.tag}`,
        head: `${this.tag}-proposal`,
        base: this.targetBranch,
        body: changelog
      },
      json: true
    });
  }

  updateLabels(number) {
    return rp({
      method: 'PATCH',
      uri: `https://${config.github.api}/repos/${this.owner}/${this.repo}/issues/${number}`,
      headers: {
        'User-Agent': 'ci-changelog',
        'authorization': `token ${this.ghToken}`,
      },
      body: {
        labels: ['release']
      },
      json: true
    });
  }
};
