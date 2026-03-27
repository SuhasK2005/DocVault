const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, '..', 'src', 'screens');

// We want to replace inline React Native styles:
// fontWeight: "800" or "900" -> fontFamily: "SpaceGrotesk_Bold"
// fontWeight: "600" or "700" -> fontFamily: "Manrope_Bold" (and remove fontWeight)
// We also want to add fontFamily: "Manrope" where there is no font weight but it's a Text component.
// Actually, global replace for fontWeight is easiest.

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.tsx')) filelist.push(dirFile);
    }
  });
  return filelist;
};

const files = walkSync(screensDir);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Space Grotesk for Headlines/Branding (800, 900, black, "Kinetic Vault", "Vault", "DocVault")
  content = content.replace(/fontWeight:\s*["'](800|900|700|black|bold)["']/g, 'fontFamily: "SpaceGrotesk_Bold"');
  
  // Manrope for other labels (implicitly everything else that is a Text component)
  // This is tricky without a parser, but we can target common properties.
  content = content.replace(/fontWeight:\s*["'](600|500|medium|semibold)["']/g, 'fontFamily: "Manrope_Bold"');
  
  // Catch Text components that don't have fontFamily yet and give them Manrope
  // (We'll do this carefully to avoid double-adding)
  // Actually, standardizing on a theme object is better.
  
  // Fix Tailwind classes
  content = content.replace(/font-black/g, 'font-[SpaceGrotesk_Bold]');
  content = content.replace(/font-bold/g, 'font-[Manrope_Bold]');
  content = content.replace(/font-semibold/g, 'font-[Manrope_Bold]');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated fonts in ${path.basename(file)}`);
  }
});

console.log('Font replacement complete.');
