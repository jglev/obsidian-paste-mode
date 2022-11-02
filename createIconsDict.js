var DOMParser = require('xmldom').DOMParser;
const fs = require('fs');
var path = require('path');

const iconFiles = fs.readdirSync(path.join('icons', 'individual-icons')).filter(f => f.endsWith('.svg'));

const iconsDict = {};

var parser = new DOMParser();

for (const f of iconFiles) {
  const contents = fs.readFileSync(path.join('icons', 'individual-icons', f)).toString();
  const dom = parser.parseFromString(contents, 'text/xml');
  dom.documentElement.setAttribute('viewBox', '0 0 100 100');
  const svgChildren = dom.getElementsByTagName('svg')[0].childNodes;

  iconsDict[`pasteIcons-${f.replace('.svg', '')}`] = svgChildren.toString();
}

fs.writeFile('icons.json', JSON.stringify(iconsDict), (err) => {
  if (err) throw err;

  // console.log('Icons file updated.');
});
