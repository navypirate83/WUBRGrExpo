/* =====================================================================
   FINISHING THE WEBSITE FOR GITHUB PAGES
   "npm run build" first runs "expo export -p web", which makes the
   finished website in the "dist" folder. Then this little script adds
   a few things:
   - the "install as an app" tags in index.html: a link to manifest.json (in
     the "public" folder, which says the site opens as a standalone app,
     with no address bar) and the matching tags iPhones read. Without
     these, "Add to Home Screen" would just make a bookmark.
   - 404.html: a copy of index.html. GitHub Pages shows 404.html for any
     address it has no file for (like /wubrgr/binders/abc), and since
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

// Add the "install as an app" tags to index.html, just before </head>
// (the addresses start with /wubrgr/ because the site lives in that folder)
const indexPath = path.join(dist, 'index.html');
const appTags = [
  '<link rel="manifest" href="/wubrgr/manifest.json">',
  '<link rel="apple-touch-icon" href="/wubrgr/icon-192.png">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="WUBRG\'r">',
].join('\n');
// The page's own pinch-to-zoom is switched off too (the app has its own zoom
// in the Grid view; see src/lib/noPageZoom.ts), by changing the viewport tag
const html = fs.readFileSync(indexPath, 'utf8')
  .replace(/<meta name="viewport" content="[^"]*"\s*\/?>/, '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no" />');
if (!html.includes('</head>')) throw new Error('index.html has no </head> to add the app tags to');
fs.writeFileSync(indexPath, html.replace('</head>', `${appTags}\n</head>`));

// Copy index.html to 404.html, and make the empty .nojekyll file
fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

console.log('Added the app tags, 404.html and .nojekyll to dist');
