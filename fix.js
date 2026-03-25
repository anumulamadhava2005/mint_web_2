const fs = require('fs');
let content = fs.readFileSync('lib/convert/builders/reactNative.ts', 'utf8');

// The faulty line has \`http://${devHost}:3001\`
// We replace it to literally output: `http://${devHost}:3001`
// So in the JS template it should be: \`http://\${devHost}:3001\`
content = content.replace(/apiOrigin: __DEV__ \? \\\\`http:\/\/\$\{devHost\}:3001\\\\` : "[^"]+",/,
  'apiOrigin: __DEV__ ? \\`http://\\${devHost}:3001\\` : "${apiOrigin}",');

fs.writeFileSync('lib/convert/builders/reactNative.ts', content);
