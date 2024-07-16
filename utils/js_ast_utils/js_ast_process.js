const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const s3_bucket_name_ = "my-networkx-s3-bucket"
const s3_key_name_ = "js_graph_entity_summary.json"

const { scanDirectory, extractUrls, urlMapping } = require('./grep_urls');

// Configure AWS SDK
const REGION = 'ap-south-1'; // e.g. 'us-west-1'
const s3Client = new S3Client({ region: REGION });

class JSFileAnalyzer {

    constructor(directoryPath, urlMap) {
        this.directoryPath = directoryPath;
        this.urlMap = urlMap;
	console.log('AJJI->', this.urlMap)    
    }

    analyzeFiles() {
        console.log('Starting analysis...');
        const results = {};

        const filePaths = this.getAllJSFiles(this.directoryPath);
        console.log('Files to analyze:', filePaths);

        for (const filePath of filePaths) {
            console.log('Analyzing file:', filePath);
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const fileResult = {
                method_details_: this.extractMethods(fileContent, filePath),
                text_details_: []
            };
            console.log( 'RETURNING::', fileResult.method_details_[ fileResult.method_details_.length - 1 ], fileResult.method_details_.length )

	    if (!filePath.startsWith('./')) {
               filePath = './' + filePath;
            }	
            results[filePath] = fileResult;
        }

	// Parameters for S3 upload
	const uploadParams = {
	  Bucket: s3_bucket_name_,
	  Key: s3_key_name_,
	  Body: JSON.stringify(results, null, 2),
	  ContentType: 'application/json'
	};  

	// Upload JSON data to S3
	const run = async () => {
	  try {
	    const parallelUploads3 = new Upload({
	      client: s3Client,
	      params: uploadParams,
	    });

	    parallelUploads3.on('httpUploadProgress', (progress) => {
	      console.log(progress);
	    });

	    await parallelUploads3.done();
	    console.log('Successfully uploaded data');
	  } catch (err) {
	    console.log('Error uploading data:', err);
	  }
	};

	run();    
        console.log('Analysis complete. Results saved to S3');
    }

    getAllJSFiles(directoryPath) {
        let filePaths = [];
        const files = fs.readdirSync(directoryPath);
        console.log('Reading directory:', directoryPath);

        for (const file of files) {
            const fullPath = path.join(directoryPath, file);
            if (fs.statSync(fullPath).isDirectory()) {
                console.log('Entering directory:', fullPath);
                filePaths = filePaths.concat(this.getAllJSFiles(fullPath));
            } else if (path.extname(fullPath) === '.js') {
                console.log('Found JS file:', fullPath);
                filePaths.push(fullPath);
            }
        }

        return filePaths;
    }

    extractMethods(fileContent, filePath) {
        //console.log('Extracting methods from:', filePath);
        const methods = [];
	let url_declaration_file_ = 'NA';    
	let url_declaration_ = 'NA';    

        const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);
        const fileText = sourceFile.text; // Accessing the text property

	function extractUrls(fileContent) {
	    // Regular expression to match URLs starting with http or https
	    const urlPattern = /(https?:\/\/[^\s"'`]+)/g;
	    const urls = [];

	    // Split content by lines and search for URLs
	    const lines = fileContent.split('\n');
	    lines.forEach((line, index) => {
		const match = line.match(urlPattern);
		if (match) {
		    match.forEach(url => {
			// Remove trailing characters after the URL
			const cutOffIndex = url.search(/[)]/);
			if (cutOffIndex !== -1) {
			    url = url.substring(0, cutOffIndex);
			}
			urls.push({ url, lineNumber: index + 1 });
		    });
		}
	    });

	    return urls;
	}

        const visit = (node) => {
            if ( ( ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ( ts.isVariableDeclaration(node) && node.initializer && ts.isArrowFunction(node.initializer) ) ) && node.body && node.body.pos !== undefined && node.name && node.name.getText() ) {

                const functionName = node.name ? node.name.getText() : 'anonymous';

                const methodBegin = fileContent.substring(node.pos, node.body.pos).trim().split('\n')[0].trim();

                const methodBodyLines = fileContent.substring(node.body.pos, node.body.end).split('\n').map(line => line.trim()).filter(line => line);
                let methodEnd = '';
                if (methodBodyLines.length > 1) {
                    for (let i = methodBodyLines.length - 1; i >= 0; i--) {
                        if (methodBodyLines[i] !== '}') {
                            methodEnd = methodBodyLines[i];
                            break;
                        }
                    }
                } else {
                    methodEnd = methodBodyLines.length > 0 ? methodBodyLines[0] : methodBegin;
                }

                const methodRange = [sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1, sourceFile.getLineAndCharacterOfPosition(node.end).line + 1];

                const methodParameters = node.parameters ? node.parameters.map(param => param.getText()) : [];
		const returnType = (node.initializer && node.initializer.body) ? extractReturnType(node.initializer.body) : 'NA';

		const methodBody = fileContent.substring(node.body.pos, node.body.end);    

		let urls_used_tuple_ = []
	        urls_used_tuple_ = extractUrls( methodBody )  
                let urls_used_ = []
		for (let i = 0; i < urls_used_tuple_.length; i++) {
		      urls_used_.push( urls_used_tuple_[i].url )
		}
	        console.log('BONGO->FP::', filePath,' METHOD_LEVEL::URLS::', urls_used_)    

		// find if the method name is declared elsewhere .. as in is it a proxy for a URL
                if ( functionName in this.urlMap ){
		    url_declaration_file_ = this.urlMap[functionName].file
		    url_declaration_ = this.urlMap[functionName].url_
		}
                methods.push({
                    method_name: functionName,
                    method_begin: methodBegin,
                    method_end: methodEnd,
                    range: methodRange,
                    parameters: methodParameters,
                    file_path: filePath,
		    returnType: returnType,
		    if_api_url_declaration_file_: url_declaration_file_,	
		    api_end_point: url_declaration_,	
		    inter_service_api_call: urls_used_,	
                    global_uses: [],
                    local_uses: []
                });

                console.log('Found method:', functionName, methodBegin, methodEnd, url_declaration_file_, url_declaration_ );
            }

	    else if ( ts.isVariableDeclaration(node) && node.initializer && ts.isArrowFunction(node.initializer) && node.name && node.name.getText() ) {
		    const functionName = node.name ? node.name.getText() : 'anonymous';
		    const parameters = node.initializer.parameters.map(param => param.getText());

		    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
		    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

		    const startLineText = getLineText(sourceFile, start.line);
		    const endLineText = getLineText(sourceFile, end.line);		    

		    const returnType = extractReturnType(node.initializer.body);

		    // find if the method name is declared elsewhere .. as in is it a proxy for a URL
                    if ( functionName in this.urlMap ){
		       url_declaration_file_ = this.urlMap[functionName].file
		       url_declaration_ = this.urlMap[functionName].url_
		    }

		    // since this is at a file level we will need to just pass the entire filecontent 
		    let urls_used_tuple_ = []
	            urls_used_tuple_ = extractUrls( fileContent )  
                    let urls_used_ = []
		    for (let i = 0; i < urls_used_tuple_.length; i++) {
			    console.log( 'BUGALOOO->', urls_used_tuple_[i].url, urls_used_tuple_[i].lineNumber );
			    if (urls_used_tuple_[i].lineNumber > start.line + 1 && urls_used_tuple_[i].lineNumber < end.line + 1){
			      urls_used_.push( urls_used_tuple_[i].url )
			}	
		    }

	            console.log('BONGO->FP::', filePath,' METHOD_LEVEL2::URLS::', urls_used_)    

		    methods.push({
			method_name: functionName,
                        method_begin: startLineText,
                        method_end: endLineText,
			range: [ start.line + 1, end.line + 1 ],
			parameters: parameters,
                        file_path: filePath,
			returnType: returnType,
		        if_api_url_declaration_file_: url_declaration_file_,	
		        api_end_point: url_declaration_,	
		        inter_service_api_call: urls_used_,	
                        global_uses: [],
                        local_uses: []
		    });

                    console.log('Found method2:', functionName, [ start.line + 1, end.line + 1 ], functionName in this.urlMap, startLineText, endLineText, url_declaration_file_, url_declaration_ );
	    }
		
            ts.forEachChild(node, visit);
        };

	const getLineText = (sourceFile, lineNumber) => {
		const lineStart = sourceFile.getPositionOfLineAndCharacter(lineNumber, 0);
		const lineEnd = sourceFile.getPositionOfLineAndCharacter(lineNumber + 1, 0);
		return sourceFile.text.substring(lineStart, lineEnd).trim();
	};

	const extractReturnType = (body) => {
		let returnTypes = [];

		const visitReturnStatements = (node) => {
		    if (ts.isReturnStatement(node) && node.expression) {
			returnTypes.push(node.expression.getText());
		    }
		    ts.forEachChild(node, visitReturnStatements);
		};

		visitReturnStatements(body);

		if (returnTypes.length > 0) {
		    return returnTypes.join(' | ');
		} else if (ts.isExpression(body)) {
		    return body.getText();
		}

		return 'void';
	};

        visit(sourceFile);
        return methods;
    }
}

const directoryPath = process.argv[2];
if (!directoryPath) {
    console.error('Please provide a directory path as an argument.');
    process.exit(1);
}

//before you do this, also find all the URLs being declared and their definitions
scanDirectory( directoryPath );

const analyzer = new JSFileAnalyzer( directoryPath, urlMapping );
analyzer.analyzeFiles();

