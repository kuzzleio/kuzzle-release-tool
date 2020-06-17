const exec = require('../exec-promise');

function changeDocTags (dir, tag) {
  return exec(dir, [
    ` grep -lR 'change-me' --include=\*.md doc/ \
    | xargs sed -i s/change-me/${tag}/g`
  ]);
}

module.exports = changeDocTags;