const fs = require('fs');
const path = require('path');

class GlobalUsesUpdater {
    constructor(jsonFilePath) {
        this.jsonFilePath = jsonFilePath;
        this.results = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
    }

    updateGlobalUses() {
        console.log('Starting global uses update...');
        
        // Create a map of method names to file paths and method details
        const methodMap = new Map();
        for (const [filePath, fileData] of Object.entries(this.results)) {
            for (const method of fileData.method_details_) {
                const methodName = method.method_name;
                const methodSignature = { filePath, parameters: method.parameters };
                if (!methodMap.has(methodName)) {
                    methodMap.set(methodName, []);
                }
                methodMap.get(methodName).push({ methodSignature, method });
            }
        }

        // Iterate over each file and method to find global uses
        for (const [filePath, fileData] of Object.entries(this.results)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            for (const method of fileData.method_details_) {
                const methodName = method.method_name;
                const regex = new RegExp(`\\b${methodName}\\b`, 'g');

                for (const [otherFilePath, otherFileData] of Object.entries(this.results)) {
                    if (otherFilePath !== filePath) {
                        const otherFileContent = fs.readFileSync(otherFilePath, 'utf-8');
                        let match;
                        while ((match = regex.exec(otherFileContent)) !== null) {
                            const lineNumber = this.getLineNumber(otherFileContent, match.index);
                            const usageLine = this.getLineByNumber(otherFileContent, lineNumber);
                            const usageParams = this.extractParametersFromCall(usageLine);
		            
                            for (const { methodSignature, method: refMethod } of methodMap.get(methodName)) {
                                if (methodSignature.filePath !== otherFilePath && this.compareParameters(methodSignature.parameters, usageParams)) {
                                    const usageDetails = {
                                        file_path: otherFilePath,
                                        ref_file_path: methodSignature.filePath,
                                        method_nm: refMethod.method_name,
                                        method_range: refMethod.range,
                                        usage: usageLine
                                    };
                                    method.global_uses.push(usageDetails);
				    console.log('DUM DUM->', usageDetails)				
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        fs.writeFileSync(this.jsonFilePath, JSON.stringify(this.results, null, 2));
        console.log('Global uses update complete. Results saved to', this.jsonFilePath);
    }

    getLineNumber(content, position) {
        return content.substring(0, position).split('\n').length;
    }

    getLineByNumber(content, lineNumber) {
        return content.split('\n')[lineNumber - 1];
    }

    extractParametersFromCall(line) {
        const match = line.match(/\(([^)]*)\)/);
        return match ? match[1].split(',').map(param => param.trim()) : [];
    }

    compareParameters(methodParams, usageParams) {
	    if (Math.abs(methodParams.length - usageParams.length) <= 1) {
		return true;
	    }
	    return false;
    }
}

const jsonFilePath = process.argv[2];
if (!jsonFilePath) {
    console.error('Please provide the path to the analysis_results.json file as an argument.');
    process.exit(1);
}

const updater = new GlobalUsesUpdater(jsonFilePath);
updater.updateGlobalUses();

