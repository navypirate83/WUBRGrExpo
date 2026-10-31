/* =====================================================================
   FINISHING THE WEBSITE FOR GITHUB PAGES
   "npm run build" first runs "expo export -p web", which makes the
   finished website in the "dist" folder. Then this little script adds
   two files GitHub Pages needs:
   - 404.html: a copy of index.html. GitHub Pages shows 404.html for any
     address it has no file for (like /WUBRGrExpo/binders/abc), and since
     it's the app itself, the app opens and shows the right page instead
     of "page not found".
   - .nojekyll: an empty file that tells GitHub Pages not to run Jekyll
     (a tool that hides files whose names start with "_", and Expo makes
     some of those).
   ===================================================================== */

const fs = require('fs');
const path = require('path');

// Where the finished website is
const dist = path.join(__dirname, '..', 'dist');

// Copy index.html to 404.html, and make the empty .nojekyll file
fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

console.log('Added 404.html and .nojekyll to dist');
