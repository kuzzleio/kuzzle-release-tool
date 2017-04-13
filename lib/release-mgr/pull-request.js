const
  rp = require('request-promise')
  , config = require('../../config.json')

module.exports = {
  create (owner, repo, ghToken, tag, changelog) {
    return rp({
      uri: `https://${config.github.api}/repos/${owner}/${repo}/pulls?access_token=${ghToken}`
      , method: 'POST'
      , headers: {
        'user-agent': 'ci-changelog'
      }
      , body: {
        title: `Release ${tag}`
        , head: `${tag}-proposal`
        , base: 'master'
        , body: changelog
      }
      , json: true
    })
  }
  , updateLabels (owner, repo, number, ghToken) {
    return rp({
      method: 'PATCH'
      , uri: `https://${config.github.api}/repos/${owner}/${repo}/issues/${number}?access_token=${ghToken}`
      , headers: {
        'User-Agent': 'ci-changelog'
      }
      , body: {
        labels: ['release']
      }
      , json: true
    })
  }
  , updateStatus (owner, repo, sha, status, ghToken, build) {
    return rp({
      method: 'POST'
      , uri: `https://${config.github.api}/repos/${owner}/${repo}/statuses/${sha}?access_token=${ghToken}`
      , headers: {
        'User-Agent': 'ci-changelog'
      }
      , body: {
        state: status,
        target_url: `https://travis-ci.org/kuzzleio/kuzzle-test-environment/builds/${build}`,
        description: (status === 'pending' ? 'Test environment is in progress' : (status === 'error' ? 'Test environment failed' : 'Test environment completed')),
        context: 'kuzzle/test-environment'
      }
      , json: true
    })
  }
}
