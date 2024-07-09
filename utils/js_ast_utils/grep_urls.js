const fs = require('fs');
const path = require('path');

const urlMapping = {};

function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanDirectory(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.ts')) {
            extractUrls(fullPath);
        }
    });
}

function extractUrls(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Regex patterns to match various URL definitions
    const urlRegexPatterns = [
        /app\.(get|post|put|delete)\(['"`](.*?)['"`],\s*(\w+)/g,                      // Simple string literals
        /app\.(get|post|put|delete)\([`"](\${?.*?})[`"],\s*(\w+)/g,                   // Template literals
        /app\.(get|post|put|delete)\(\s*([`"])(.*?)\2\s*,\s*(\w+)/g,                 // Template literals with concatenation
        /route:\s*['"`](.*?)['"`],\s*handler:\s*['"`](\w+)['"`]/g,                    // Config style route definition
        /route:\s*`(.*?)`,\s*handler:\s*['"`](\w+)['"`]/g                             // Config style route definition with template literals
    ];

    urlRegexPatterns.forEach(regex => {
        let match, url_dec_;
        while ((match = regex.exec(fileContent)) !== null) {
            const [ url_declaration, method, url, handler] = match;
	    const regex = /route:\s*`\$\{.*?\}(.*?)`/;
	    const url_match = url_declaration.match( regex );

	    if ( url_match && url_match[1] ) {
              url_dec_ = url_match[1];
	    }
	    else {
              url_dec_ = url_declaration;
	    }

            urlMapping[url] = { file: filePath, method_nm: handler, url_: url_dec_ };
        }
    });
}

// Scan the project directory
scanDirectory('../idp_backend/');

console.log(urlMapping);

module.exports = {
    scanDirectory,
    extractUrls,
    urlMapping
};
