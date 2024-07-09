const fs = require('fs');

fs.readFile('data.json', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
  } else {
    const jsonData = JSON.parse(data);
    //console.log('File has been read successfully:', jsonData);
    for ( const key in jsonData ){
	    bucket_ = jsonData[ key ]

	    for ( const key1 in bucket_ ){
		    handler_url_ = bucket_[ key1 ]
                    console.log('URL->', handler_url_.url);			
	    }
    }
  }
});

