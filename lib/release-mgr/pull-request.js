const
  rp = require('request-promise'),
  config = require('../../config.json');

module.exports = class PullRequest {
  constructor(owner, repo, tag, ghToken) {
    this.owner = owner;
    this.repo = repo;
    this.tag = tag;
    this.ghToken = ghToken;
  }

  create(changelog) {
    return rp({
      uri: `https://${config.github.api}/repos/${this.owner}/${this.repo}/pulls?access_token=${this.ghToken}`,
      method: 'POST',
      headers: {
        'user-agent': 'ci-changelog'
      },
      body: {
        title: `Release ${this.tag}`,
        head: `${this.tag}-proposal`,
        base: 'master',
        body: changelog
      },
      json: true
    });
  }

  updateLabels(number) {
    return rp({
      method: 'PATCH',
      uri: `https://${config.github.api}/repos/${this.owner}/${this.repo}/issues/${number}?access_token=${this.ghToken}`,
      headers: {
        'User-Agent': 'ci-changelog'
      },
      body: {
        labels: ['release']
      },
      json: true
    });
  }

  updateStatus(sha, status, build) {
    console.log(`https://${config.github.api}/repos/${this.owner}/${this.repo}/statuses/${sha}?access_token=${this.ghToken}`);

    return rp({
      method: 'POST',
      uri: `https://${config.github.api}/repos/${this.owner}/${this.repo}/statuses/${sha}?access_token=${this.ghToken}`,
      headers: {
        'User-Agent': 'ci-changelog'
      },
      body: {
        state: status,
        target_url: `https://travis-ci.org/kuzzleio/kuzzle-test-environment/builds/${build}`,
        description: (status === 'pending' ? 'Test environment is in progress' : (status === 'error' ? 'Test environment failed' : 'Test environment completed')),
        context: 'kuzzle/test-environment'
      },
      json: true
    });
  }
};
