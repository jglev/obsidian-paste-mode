const fs = require('fs');
var path = require('path');

const iconFiles = fs.readdirSync('icons').filter(f => f.endsWith('.svg'))

const iconsDict = {};

for (const f of iconFiles) {
  const contents = fs.readFileSync(path.join('icons', f)).toString();

  iconsDict[`pasteIcons-{f.replace('.svg', '')}`] = contents;
}

fs.writeFile('icons.json', JSON.stringify(iconsDict), (err) => {
  // throws an error, you could also catch it here
  if (err) throw err;

  // success case, the file was saved
  console.log('Icons file updated.');
});
