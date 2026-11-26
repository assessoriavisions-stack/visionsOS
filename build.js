// Gera index.html (arquivo único) a partir de src/. Uso: node build.js
const fs = require('fs'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, p), 'utf8');
const js = fs.readdirSync(path.join(__dirname, 'src')).filter(f => /^\d+-.*\.js$/.test(f)).sort()
  .map(f => '/* ---- ' + f + ' ---- */\n' + R('src/' + f)).join('\n');
const out = R('src/index.template.html')
  .split('{{CSS}}').join(R('src/styles.css'))
  .split('{{ICON}}').join(R('assets/icon.datauri').trim())
  .split('{{LOGO}}').join(R('assets/logo.datauri').trim())
  .replace('{{JS}}', () => js);
fs.writeFileSync(path.join(__dirname, 'index.html'), out);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), out); // pasta publicada no Netlify
console.log('index.html gerado:', (out.length / 1024).toFixed(0) + ' KB');
