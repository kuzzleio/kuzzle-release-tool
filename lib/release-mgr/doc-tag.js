const exec = require('../exec-promise');

function changeDocTags (dir, tag) {
  return exec(dir, [
    ` grep -lR 'auto-version' --include=\*.md doc/ \
    | xargs sed -i s/auto-version/${tag}/g`
  ]);
}

module.exports = changeDocTags;