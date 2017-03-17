let
  hasBreakingChanges = false

const
  labelsPriority = ['Breaking change'
    , 'New feature'
    , 'Enhencement'
    , 'Bug fixes']

const formatIssues = (owner, repo, issues) => {
  let s = issues.length > 0 ? 'resolve' : ''

  issues.forEach(i => {
    if (!i.repo) {
      // Internal issue to the current repository
      s += ` [\#${i.id}](https://github.com/repos/${owner}/${repo}/issues/${i.id})`
    } else {
      // External issue
      s += ` [${i.repo}\#${i.id}](https://github.com/repos/${i.repo}/issues/${i.id})`
    }
  })
  return s
}

const checkIfMajor = (currentVersion, tag) => {
  if (currentVersion.split('.')[0] < tag.split('.')[0]) {
    return true
  }
  return false
}

const groupByLabel = prs => {
  let parts = {}

  for (let pr of prs) {
    if (!pr) continue

    // if no label, put in default one
    if (pr.labels.length === 0) {
      delete pr.labels
      if (!parts['Merged pull request']) {
        parts['Merged pull request'] = []
      }
      parts['Merged pull request'].push(pr)
    } else {
      if (pr.labels.includes('changelog:breaking-change')) {
        hasBreakingChanges = true
      }

      // Exclude all changelog:exclude labels
      pr.labels = pr.labels
        .filter(e => e !== 'changelog:exclude')

      // Complement
      if (pr.body) {
        prs.map(p => {
          if (p) {
            if (parseInt(p.id) === parseInt(pr.body.replace('complement #', ''))) {
              if (!p.complement) {
                p.complement = []
              }
              p.complement.push({id: pr.id, url: pr.url})
            }
          }
        })
      }
      pr.labels = pr.labels
        .filter(e => e !== 'changelog:complement')

      pr.labels
        .filter(e => e.includes('changelog:'))
        .map(e => {
          let parsedLabel = e.replace('changelog:', '').replace('-', ' ')
          parsedLabel = parsedLabel.charAt(0).toUpperCase() + parsedLabel.slice(1)

          if (!parts[parsedLabel]) {
            parts[parsedLabel] = []
          }
          parts[parsedLabel].push(pr)
        })

      pr.labels
        .filter(e => !e.includes('changelog:'))
        .map(() => {
          if (!parts['Merged pull request']) {
            parts['Merged pull request'] = []
          }
          parts['Merged pull request'].push(pr)
        })

      delete pr.labels
    }
  }

  return parts
}

const verifyBreakingChange = (hasBreakingChanges, currentVersion, tag) => {
  if (hasBreakingChanges) {
    if (!checkIfMajor(currentVersion, tag)) {
      console.warn(`Seems you have breaking changes but didn't specify a major version:\nCurrent version: ${currentVersion}\nNew version: ${tag}\n`)
    }
  }
}

const sortByLabel = (prs) => {
  let sortedPrs = {}

  for (let label of labelsPriority) {
    if (prs[label]) {
      sortedPrs[label] = prs[label]
      delete prs[label]
    }
  }
  Object.assign(sortedPrs, prs)

  return sortedPrs
}

module.exports = {
  generate (owner, repo, tag, currentVersion, prs) {
    const
      date = new Date()
      , month = date.getMonth() + 1

    let
      changeLog = ''

    prs = groupByLabel(prs)
    prs = sortByLabel(prs)

    verifyBreakingChange(hasBreakingChanges, currentVersion, tag)

    changeLog += `### [${tag}](https://github.com/${owner}/${repo}/releases/tag/${tag}) (${date.getFullYear()}-${(month < 10 ? '0' + month : month)}-${date.getDate()})\n\n`
    changeLog += `[Full Changelog](https://github.com/${owner}/${repo}/compare/${currentVersion}...${tag})\n`

    Object.keys(prs).forEach(k => {
      changeLog += `\n#### ${k}\n\n`
      for (let pr of prs[k]) {
        let ids = `[\#${pr.id}](${pr.url})`

        if (pr.complement) {
          pr.complement.forEach(c => {
            ids += `, [\#${c.id}](${c.url})`
          })
        }
        changeLog += `- [ ${ids} ] ${pr.title}  ${formatIssues(owner, repo, pr.issues)} ([${pr.author.login}](${pr.author.url}))\n`
      }
    })
    changeLog += `---\n\n`
    return changeLog
  }
}
