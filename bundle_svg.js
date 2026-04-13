const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();
const INPUT_FILE = path.join(ROOT_DIR, 'index.html');
const OUTPUT_FILE = path.join(ROOT_DIR, 'index.svg');

function getBase64(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase().replace('.', '');
        const mimeType = ext === 'svg' ? 'image/svg+xml' : 
                         ext === 'png' ? 'image/png' :
                         ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                         ext === 'gif' ? 'image/gif' :
                         ext === 'webp' ? 'image/webp' : 
                         ext === 'ico' ? 'image/x-icon' : `application/octet-stream`;
        return `data:${mimeType};base64,${fileContent.toString('base64')}`;
    } catch (e) {
        console.error(`Could not read file: ${filePath}`);
        return '';
    }
}

function inlineAssets(html) {
    // 1. Inline CSS
    const linkRegex = /<link[^>]+href=["']([^"']+\.(?:css))["'][^>]*>/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
        const fullTag = linkMatch[0];
        let cssPath = linkMatch[1];
        if (cssPath.startsWith('/')) cssPath = cssPath.slice(1);
        const fullCssPath = path.join(ROOT_DIR, cssPath);
        
        if (fs.existsSync(fullCssPath)) {
            let cssContent = fs.readFileSync(fullCssPath, 'utf8');
            
            // Inline images in CSS
            const urlRegex = /url\(["']?([^"']+\.(?:png|jpg|jpeg|gif|svg|webp|ico))["']?\)/gi;
            cssContent = cssContent.replace(urlRegex, (match, imgPath) => {
                if (imgPath.startsWith('http')) return match;
                if (imgPath.startsWith('data:')) return match;
                if (imgPath.startsWith('/')) imgPath = imgPath.slice(1);
                const fullImgPath = path.resolve(path.dirname(fullCssPath), imgPath);
                if (fs.existsSync(fullImgPath)) {
                    return `url("${getBase64(fullImgPath)}")`;
                }
                return match;
            });
            
            html = html.replace(fullTag, `<style>\n/* Inlined: ${cssPath} */\n${cssContent}\n</style>`);
        }
    }

    // 2. Inline Scripts
    const scriptRegex = /<script[^>]+src=["']([^"']+\.(?:js))["'][^>]*><\/script>/gi;
    let scriptMatch;
    while ((scriptMatch = scriptRegex.exec(html)) !== null) {
        const fullTag = scriptMatch[0];
        let scriptPath = scriptMatch[1];
        if (scriptPath.startsWith('/')) scriptPath = scriptPath.slice(1);
        const fullScriptPath = path.join(ROOT_DIR, scriptPath);

        if (fs.existsSync(fullScriptPath)) {
            let scriptContent = fs.readFileSync(fullScriptPath, 'utf8');
            // Clean up possible sourceMappingURL
            const cleanedScript = scriptContent.replace(/\/\/# sourceMappingURL=.*/g, '');
            html = html.replace(fullTag, `<script type="text/javascript">\n// Inlined: ${scriptPath}\n${cleanedScript}\n</script>`);
        }
    }

    // 3. Inline images in <img> tags (more robust)
    const imgRegex = /<img([^>]+)src=["']([^"']+\.(?:png|jpg|jpeg|gif|svg|webp|ico))["']([^>]*)>/gi;
    html = html.replace(imgRegex, (match, before, imgPath, after) => {
        if (imgPath.startsWith('http') || imgPath.startsWith('data:')) return match;
        let cleanPath = imgPath;
        if (cleanPath.startsWith('/')) cleanPath = cleanPath.slice(1);
        const fullImgPath = path.join(ROOT_DIR, cleanPath);
        if (fs.existsSync(fullImgPath)) {
            return `<img${before}src="${getBase64(fullImgPath)}"${after}>`;
        }
        return match;
    });

    return html;
}

function collectData(dir, prefix = '') {
    const results = {};
    if (!fs.existsSync(dir)) return results;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const relPath = path.join(prefix, file).replace(/\\/g, '/');
        
        if (fs.statSync(fullPath).isDirectory()) {
            Object.assign(results, collectData(fullPath, relPath));
        } else {
            if (file.endsWith('.json') || file.endsWith('.css') || file.endsWith('.js')) {
                results['/' + relPath] = fs.readFileSync(fullPath, 'utf8');
            }
        }
    }
    return results;
}

function bundle() {
    console.log('Reading index.html...');
    let html = fs.readFileSync(INPUT_FILE, 'utf8');

    console.log('Inlining core assets...');
    html = inlineAssets(html);

    // Fix HTML entities for XML compatibility
    console.log('Fixing HTML entities for XML compatibility...');
    html = html.replace(/&nbsp;/g, '&#160;');
    html = html.replace(/&copy;/g, '&#169;');
    html = html.replace(/&mdash;/g, '&#8212;');
    html = html.replace(/&ndash;/g, '&#8211;');
    html = html.replace(/&rsquo;/g, '&#8217;');
    html = html.replace(/&lsquo;/g, '&#8216;');
    html = html.replace(/&rdquo;/g, '&#8221;');
    html = html.replace(/&ldquo;/g, '&#8220;');
    html = html.replace(/&hellip;/g, '&#8230;');

    // Collect all JSON and CSS files that might be fetched/loaded dynamically
    console.log('Collecting dynamic assets (themes, JSON)...');
    const dynamicAssets = {
        ...collectData(path.join(ROOT_DIR, 'asset', 'json'), 'asset/json'),
        ...collectData(path.join(ROOT_DIR, 'style', 'theme'), 'style/theme'),
        ...collectData(path.join(ROOT_DIR, 'style', 'alt-theme'), 'style/alt-theme'),
    };

    // Extract Title
    const titleMatch = /<title>([^<]+)<\/title>/i.exec(html);
    const title = titleMatch ? titleMatch[1] : 'Vapor v4';

    // Extract Head Metadata (meta tags)
    const headMeta = [];
    const metaRegex = /<(meta[^>]+)>/gi;
    let metaMatch;
    while ((metaMatch = metaRegex.exec(html)) !== null) {
        headMeta.push(metaMatch[1]);
    }

    // Extract Body Content
    const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
    const bodyContent = bodyMatch ? bodyMatch[1] : html;

    // DOM Shim Script
    const domShim = `
(() => {
  const ns = 'http://www.w3.org/1999/xhtml';
  const body = document.querySelector('body');
  if (!body) return;
  const svgRoot = document.documentElement;

  const head = document.createElementNS(ns, 'head');
  body.prepend(head);

  const htmlRoot = body.parentElement && body.parentElement.namespaceURI === ns
    ? body.parentElement
    : body;

  try {
    Object.defineProperty(document, 'head', {
      configurable: true,
      get() { return head; },
    });
  } catch {}

  try {
    Object.defineProperty(document, 'body', {
      configurable: true,
      get() { return body; },
    });
  } catch {}

  try {
    Object.defineProperty(document, 'documentElement', {
      configurable: true,
      get() { return htmlRoot; },
    });
  } catch {}

  try {
    Object.defineProperty(svgRoot, 'className', {
      configurable: true,
      get() { return svgRoot.getAttribute('class') || ''; },
      set(value) { svgRoot.setAttribute('class', value || ''); },
    });
  } catch {}

  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function createElement(tagName, options) {
    const el = typeof tagName === 'string'
      ? document.createElementNS(ns, tagName, options)
      : originalCreateElement(tagName, options);
    
    // Intercept link creation for themes
    if (tagName === 'link') {
       Object.defineProperty(el, 'href', {
          set(val) {
             const url = new URL(val, window.location.href).pathname;
             if (window._VAP_ASSETS && window._VAP_ASSETS[url]) {
                const style = document.createElement('style');
                style.id = el.id;
                style.textContent = window._VAP_ASSETS[url];
                // Wait for append to head then swap
                setTimeout(() => {
                    if (el.parentNode) {
                        el.parentNode.replaceChild(style, el);
                        if (el.onload) el.onload();
                    }
                }, 0);
             } else {
                el.setAttribute('href', val);
             }
          },
          get() { return el.getAttribute('href'); }
       });
    }
    return el;
  };

  // Intercept Fetch for JSON
  const originalFetch = window.fetch;
  window.fetch = async function(resource, init) {
      let url = resource;
      if (typeof resource === 'string') {
          url = new URL(resource, window.location.href).pathname;
      } else if (resource instanceof Request) {
          url = new URL(resource.url).pathname;
      }
      
      if (window._VAP_ASSETS && window._VAP_ASSETS[url]) {
          return new Response(window._VAP_ASSETS[url], {
              status: 200,
              headers: { 'Content-Type': url.endsWith('.json') ? 'application/json' : 'text/plain' }
          });
      }
      return originalFetch(resource, init);
  };
})();

// Data Assets
window._VAP_ASSETS = ${JSON.stringify(dynamicAssets, null, 2)};

// Injecting Meta Tags from original Head
const headTags = [
  ${headMeta.map(m => `"${m.replace(/"/g, '\\"')}"`).join(',\n  ')}
];
headTags.forEach(tagString => {
    const dummy = document.createElement('div');
    dummy.innerHTML = '<' + tagString + '>';
    const el = dummy.firstChild;
    if (el) document.head.appendChild(el);
});

const titleEl = document.createElement('title');
titleEl.textContent = "${title.replace(/"/g, '\\"').replace(/\n/g, ' ')}";
document.head.appendChild(titleEl);
`;

    const svgTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="position: fixed; inset: 0;">
  <foreignObject x="0" y="0" width="100%" height="100%">
    <body xmlns="http://www.w3.org/1999/xhtml" lang="en" style="margin: 0; width: 100%; height: 100%; min-height: 100vh; overflow: auto; background-color: #0a111d; color: #d5dce8;">
      <div id="root-svg-container" style="width: 100%; min-height: 100vh;">
        ${bodyContent}
      </div>
      <script>
      <![CDATA[
${domShim}
      ]]>
      </script>
    </body>
  </foreignObject>
</svg>`;

    console.log('Writing output to index.svg...');
    fs.writeFileSync(OUTPUT_FILE, svgTemplate);
    console.log('Done!');
}

bundle();
