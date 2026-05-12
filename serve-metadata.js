const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const METADATA_FILE = path.join(__dirname, 'oauth-client-metadata.json');

const server = http.createServer((req, res) => {
  // ATProto requires the content-type to be application/json
  if (req.url === '/oauth-client-metadata.json') {
    fs.readFile(METADATA_FILE, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Metadata server running at http://localhost:${PORT}/oauth-client-metadata.json`);
});
