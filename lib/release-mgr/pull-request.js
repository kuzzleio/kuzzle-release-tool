const
  rp = require('request-promise')
  , config = require('../../config.json')

module.exports = {
  create (owner, repo, ghToken, tag, changelog) {
    console.log(owner, repo, tag)
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
    return rq({
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
}
