const exec = require('../exec-promise');

async function changeDocTags (dir, tag) {
  try {
    await exec(dir, 'test -d doc/');

    return await exec(dir, [
      `grep -lR 'auto-version' --include='*.md' --include='*.json' --include='*.js' --include='*.ts' doc/ | xargs sed -i s/auto-version/${tag}/g`
    ]);
  }
  catch (error) {
    // ignore
  }
}

module.exports = changeDocTags;
