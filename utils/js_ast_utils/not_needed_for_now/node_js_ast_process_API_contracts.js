
// ideally there will be 2 buckets here .. found and unknown ..
// a) found if the URL's handler is defined locally 
//    - in this case we need to trawl through OTHER code bases to find wher e this url is being used
// b) UNK if the URL's handler has not been found
//    - in this case its possible that this code base is consuming services from other code bases
//    - so trawl other code bases to find definition of this particular URL
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { findHandlerDefinitions } = require('./findHandlerAssignments');

// Function to recursively read all files in a directory
const getAllFiles = (dir, files) => {
  files = files || [];
  const items = fs.readdirSync(dir);
  items.forEach((item) => {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  });
  return files;
};

// Function to search for URLs in a file
const searchForURLs = (fileContent) => {
  const urlPattern = /(?:http[s]?:\/\/\S+|`(?:\${V1})?\/\S+`)/g;
  return (fileContent.match(urlPattern) || []).filter(url => !url.includes('//registry.npmjs.org/'));
};

// Function to search for handler in config files and store associated URL
const searchForHandlers = (fileContent) => {
  const lines = fileContent.split('\n');
  const handlers = [];

  let currentRoute = null;
  let currentHandler = null;
  let currentRouteLineNum = null;
  let currentHandlerLineNum = null;
  const maxLineDiff_ = 10;	

  let insideMethod = true;  // Start with insideMethod as true	

  lines.forEach((line, index) => {
    const routeMatch = line.match(/route:\s*`([^`]*)`/);
    const handlerMatch = line.match(/handler:\s*['"](\w+)['"]/);

    if (routeMatch) {
      console.log('MATCHED ROUTE=>', routeMatch, handlerMatch)
      currentRoute = routeMatch[1];
      currentRouteLineNum = index;
    }

    if (handlerMatch) {
      console.log('MATCHED HANDLER=>', handlerMatch, routeMatch)
      currentHandler = handlerMatch[1];
      currentHandlerLineNum = index;
    }

    if (true) {
	    insideMethod = false;
	    // If both currentRoute and currentHandler are found, save them and reset
	    if (currentRoute && currentHandler && Math.abs(currentRouteLineNum - currentHandlerLineNum) <= maxLineDiff_ ) {
	      console.log('PUSHING DUMPSTER->', currentHandler, currentRoute)
	      handlers.push({ handler: currentHandler, route: currentRoute, content: fileContent });
	      currentRoute = null;
	      currentHandler = null;
	    }

	    insideMethod = true;
	}
  });

  return handlers;
};

// Function to parse the found URLs and extract the last segment, or penultimate if last is dynamic
const extractEndpointName = (url) => {
  const parsedUrl = url.replace(/`/g, ''); // Remove backticks
  const parts = parsedUrl.split('/');

  // Check if the last or the penultimate part is dynamic
  const lastPart = parts.pop();
  const penultimatePart = parts.pop();

  if (lastPart.includes('$') || penultimatePart.includes('$')) {
    return null; // Skip this URL pattern
  }

  return lastPart.replace(/[\$\{\}]/g, ''); // Return the last part after removing ${}
};

// Function to search for method definitions in a codebase
const searchInCodebase = (basePath, pattern, excludeDirectory, handler_if_provided, handlerContent_if_provided) => {
  return new Promise((resolve, reject) => {
    const excludeDirOption = excludeDirectory ? `--exclude-dir="${excludeDirectory}"` : '';
    console.log('DOGGIE->', `grep -rnw --include="*.js" --include="*.py" --include="*.java" "${pattern}" ${basePath} ${excludeDirOption}`);	  
    exec(`grep -rnw --include="*.js" --include="*.py" --include="*.java" "${pattern}" ${basePath} ${excludeDirOption}`, (error, stdout, stderr) => {
      if (error) {
        resolve([]); // Return empty if not found
      } else {

        resolve(filterDefinitions(parseGrepResult(stdout), pattern));

	if ( filterDefinitions(parseGrepResult(stdout), pattern).length === 0 && handler_if_provided !== undefined ){
                
		for ( const item of parseGrepResult(stdout) ) {
			console.log('ALT:: SEARCH HANDLER ASSIGNMENT->', handler_if_provided );
			resp_ = findHandlerDefinitions( fs.readFileSync(item.filePath, 'utf8'), handler_if_provided );
			console.log( resp_ );
		}	
	}	
      }
    });
  });
};

// Function to parse grep output
const parseGrepResult = (grepOutput) => {
  const result = [];
  const lines = grepOutput.split('\n');
  lines.forEach((line) => {
    if (line) {
      const [filePath, lineNumber, ...matchArray] = line.split(':');
      const match = matchArray.join(':').trim();
      result.push({ filePath, lineNumber: parseInt(lineNumber, 10), match });
    }
  });
  return result;
};

// Function to filter definitions from grep results
const filterDefinitions = (results, pattern) => {
  //const lhsPattern = new RegExp(`(?:const|let|var|async|function|class|${pattern}\\s*:\\s*async|${pattern}\\s*:\\s*\\()\\s+${pattern}\\b|${pattern}\\s*:\\s*function|${pattern}\\s*:\\s*async\\s*\\(|${pattern}\\s*=\\s*\\(`);	

  const lhsPattern = new RegExp(`(?:const|let|var|async|function|class|${pattern}\\s*:\\s*async|${pattern}\\s*:\\s*\\()\\s+${pattern}\\b|${pattern}\\s*:\\s*function|${pattern}\\s*:\\s*async\\s*\\(|${pattern}\\s*=\\s*\\(|${pattern}\\s*:\\s*\\(`); 
  return results.filter(result => lhsPattern.test(result.match));

};

(async () => {
  const baseDir = '../idp_backend';
  const excludeDir = 'config';
  const externalCodebases = [
    { name: 'Python', path: '/datadrive/IKG/code_db/python/', pattern: `` },
    { name: 'Java', path: './path/to/java-codebase', pattern: `public.*` },
    { name: 'Node.js', path: './path/to/nodejs-codebase', pattern: `function ` },
  ];

  const files = getAllFiles(baseDir);
  const urlMap = {
    intra: {},
    inter: {},
    not_found: {},
  };
  
  for (const file of files) {
    const fileContent = fs.readFileSync(file, 'utf8');
    const urls = searchForURLs(fileContent);
    const handlers = searchForHandlers(fileContent);

    // Process URLs
    for (const url of urls) {
      const endpointName = extractEndpointName(url);

      // Skip URLs with dynamic parts
      if (!endpointName) continue;

      // Search locally within the current service
      let localSearchResult = await searchInCodebase(baseDir, `\\b${endpointName}\\b`, excludeDir);
      if (localSearchResult.length > 0) {
	console.log( 'URL_LOGGING_HANDLER::', url, localSearchResult );      
        urlMap.intra[url] = { source: 'local', url:url, details: localSearchResult };
      } else {
        // Search in external codebases
        let foundInExternal = false;
        for (const codebase of externalCodebases) {
          console.log('SEARCHING, IN PYTHON, FOR URL->', url); 		
          let externalSearchResult = await searchInCodebase(codebase.path, `${codebase.pattern}${endpointName}\\b`);
          if (externalSearchResult.length > 0) {
            urlMap.inter[url] = { source: codebase.name, url:url, details: externalSearchResult };
            foundInExternal = true;
            break;
          }
        }
        if (!foundInExternal) {
          urlMap.not_found[url] = { source: 'unknown', url:url, details: [] };
        }
      }
    }

    // Process Handlers
    for (const { handler, route, handlerContent } of handlers) {
      // Search locally within the current service
      let localSearchResult = await searchInCodebase(baseDir, `\\b${handler}\\b`, excludeDir, handler, handlerContent );
      if (localSearchResult.length > 0) {
	console.log( 'LOGGING_HANDLER::', handler, route, localSearchResult );      
        urlMap.intra[handler] = { source: 'local', url: route, details: localSearchResult };
      } else {
        // Search in external codebases
        let foundInExternal = false;
        for (const codebase of externalCodebases) {
          console.log('SEARCHING, IN PYTHON, FOR HANDLER->', handler); 		
          let externalSearchResult = await searchInCodebase(codebase.path, `${codebase.pattern}${handler}\\b`);
          if (externalSearchResult.length > 0) {
            urlMap.inter[handler] = { source: codebase.name, url: route, details: externalSearchResult };
            foundInExternal = true;
            break;
          }
        }
        if (!foundInExternal) {
          urlMap.not_found[handler] = { source: 'unknown', url: route, details: [] };
        }
      }
    }
  }

  console.log(JSON.stringify(urlMap, null, 2));
  fs.writeFile( 'data.json', JSON.stringify( urlMap, null, 2), (err) => {
	  if (err) {
	    console.error('Error writing file:', err);
	  } else {
	    console.log('File has been written successfully.');
	  }
  });

})();

