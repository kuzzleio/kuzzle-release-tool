const exec = require('../exec-promise');

async function changeDocTags (dir, tag) {
  try {
    await exec(dir, 'test -d doc/');

    return exec(dir, [
      ` grep -lR 'auto-version' --include=\*.md doc/ \
      | xargs sed -i s/auto-version/${tag}/g`
    ]);
  }
  catch (error) {
  }
}

module.exports = changeDocTags;