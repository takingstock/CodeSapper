const fs = require('fs');
const path = require('path');

// Regex to find handler assignments and definitions
const handlerPattern = (handlerName) => new RegExp(
  `(?:const|let|var|async|function|class|${handlerName}\\s*:\\s*async|${handlerName}\\s*:\\s*\\()\\s+${handlerName}\\b|${handlerName}\\s*:\\s*function|${handlerName}\\s*:\\s*async\\s*\\(|${handlerName}\\s*=\\s*\\(|${handlerName}\\s*:\\s*\\(|${handlerName}\\s*:\\s*(\\w+)\\s*,`,
  'g'
);

// Function to verify if the assigned value is a function
const isFunction = (code, match) => {
  // Check if the assignment is a function declaration or expression
  let handlerAssignments = [];
  console.log( 'AA->', match )
  
  try {	
	  const assignedValue = match[0].split(':')[1].trim().replace(',','');
	  const assignedFunctionPattern = new RegExp(`\\b${assignedValue}\\b\\s*[:=]\\s*(async\\s*)?\\(?\\s*\\w*\\s*\\)?\\s*=>|function\\s*\\b${assignedValue}\\b`);
	  console.log('SEARCHING..', assignedFunctionPattern)

	  func_def_ = assignedFunctionPattern.exec( code )	

	  if ( func_def_ ) {
		  handlerAssignments.push({
		  handlerAssignment: match[0],
		  funcDef: func_def_[0]
		});

		console.log( 'AGGIE->',  handlerAssignments )  
	  }
  } catch ( error ) {
	  console.error('PATTERN NOT FOUND!', error);
  }

};

// Function to find handler definitions and verify they are functions
const findHandlerDefinitions = (code, handlerName) => {
  const pattern = handlerPattern(handlerName);

  const matches = [];
  let match;
  while ((match = pattern.exec(code)) !== null) {
    if (isFunction(code, match)) {
      const line = code.substring(0, match.index).split('\n').length;
      matches.push({ line, match: match[0] });
    } else {
      // Check if the handler is assigned to another variable
      const assignmentPattern = new RegExp(`(${handlerName})\\s*:\\s*(\\w+)\\s*,`);
      const assignmentMatch = assignmentPattern.exec(code);
      if (assignmentMatch) {
        const newHandler = assignmentMatch[2];
        // Recursively find the new handler definition
        const newMatches = findHandlerDefinitions(code, newHandler);
        matches.push(...newMatches);
      }
    }
  }
  return matches;
};

module.exports = {
	findHandlerDefinitions,
}
