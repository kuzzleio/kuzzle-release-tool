let
  hasBreakingChanges = false

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

module.exports = {
  generate (owner, repo, tag, currentVersion, prs) {
    const
      date = new Date()
      , month = date.getMonth() + 1

    let
      changeLog = ''

    prs = groupByLabel(prs)

    verifyBreakingChange(hasBreakingChanges, currentVersion, tag)

    changeLog += `### [${tag}](https://github.com/${owner}/${repo}/releases/tag/${tag}) (${date.getFullYear()}-${(month < 10 ? '0' + month : month)}-${date.getDate()})\n\n`
    changeLog += `[Full Changelog](https://github.com/${owner}/${repo}/compare/${currentVersion}...${tag})\n`

    Object.keys(prs).forEach(k => {
      changeLog += `\n#### ${k}\n\n`
      for (let pr of prs[k]) {
        changeLog += `- ${pr.title} [\#${pr.id}](${pr.url}) ${formatIssues(owner, repo, pr.issues)} [${pr.author.url}](${pr.author.login})\n`
      }
    })
    changeLog += `\n\n`
    return changeLog
  }
}
