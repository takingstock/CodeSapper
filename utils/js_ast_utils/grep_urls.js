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
        /handler:\s*['"`](\w+)['"`],\s*route:\s*['"`](.*?)['"`]/g,                    // Config style route definition
	/path:\s*['"`](.*?)['"`][\s\S]*?handler:\s*['"`](\w+)['"`]/g,
	/handler:\s*['"`](.*?)['"`][\s\S]*?path:\s*['"`](\w+)['"`]/g,
	/path:\s*(['"`])(.*?)\1[\s\S]*?handler:\s*(\w+)/g,
        /route:\s*`(.*?)`,\s*handler:\s*['"`](\w+)['"`]/g                             // Config style route definition with template literals
    ];

    urlRegexPatterns.forEach( (regex, index) => {
        let match, url_dec_;
	console.log( 'Trying =>', regex, ' For fileContent == ', filePath )    
        while ((match = regex.exec(fileContent)) !== null) {

            let [ url_declaration, method, url, handler] = match;

            if ( index === 4 || index === 6 ){
		    [ url_declaration, url, method, handler] = match;
		    console.log('REVERSE PATTERN=>', url, method)
	    }
            console.log('AFTER SWAP=>', method, url, [url_declaration])

	    const regex = /route:\s*`\$\{.*?\}(.*?)`/;
	    const url_match = url_declaration.match( regex );
	    console.log('URL MATCHING=>', method )	

	    if ( url_match && url_match[1] ) {
              url_dec_ = url_match[1];
	    }
	    else {
              url_dec_ = url_declaration;
	    }

            idx_ = url_dec_.indexOf( 'handler:' )
            if ( idx_ !== -1 ){
		    const regex = /handler:\s*(\w+)/;
		    const match = regex.exec( url_dec_ );
		    if (match) {
			    url_dec_ = url;
			    url = match[1];
			    console.log('PUTIN=> url; url_dec_ ', url, url_dec_ )
		    }

            }		   

            // Create a new entry
	    const newEntry = { file: filePath, method_nm: handler, url_: url_dec_ };		
	    // Add the entry to the URL mapping
	    if (!urlMapping[url]) {
              urlMapping[url] = [];  // Initialize an array if it doesn't exist
	    }

	    urlMapping[url].push(newEntry);
 
	    console.log('URL ADDED=>', filePath, handler, url_dec_, url )	
        }
    });
}

// Scan the project directory
//scanDirectory('../idp_backend/');

//console.log(urlMapping);

module.exports = {
    scanDirectory,
    extractUrls,
    urlMapping
};
