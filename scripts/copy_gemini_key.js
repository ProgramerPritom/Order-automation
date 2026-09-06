const fs = require('fs');
const path = require('path');

const srcPath = 'D:/Frontend Work/Pritom-folder/FerryKitchen-Server/.env';
const destPath = path.join(__dirname, '../.env');

if (fs.existsSync(srcPath)) {
  const content = fs.readFileSync(srcPath, 'utf8');
  const lines = content.split('\n');
  const geminiLines = lines.filter(l => l.toUpperCase().includes('GEMINI'));
  
  if (geminiLines.length > 0) {
    let currentDest = fs.existsSync(destPath) ? fs.readFileSync(destPath, 'utf8') : '';
    let added = false;
    for (const gLine of geminiLines) {
      const keyName = gLine.split('=')[0].trim();
      if (!currentDest.includes(keyName) && gLine.trim().length > 0) {
        currentDest += `\n${gLine.trim()}\n`;
        added = true;
      }
    }
    if (added) {
      fs.writeFileSync(destPath, currentDest, 'utf8');
      console.log('✅ Successfully copied GEMINI config to .env');
    } else {
      console.log('ℹ️ GEMINI config already present in .env');
    }
  } else {
    console.log('⚠️ No GEMINI lines found in FerryKitchen-Server/.env');
  }
} else {
  console.log('⚠️ FerryKitchen-Server/.env does not exist');
}
