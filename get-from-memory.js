const http = require('http');

// Konversations-ID att hämta
const conversationID = 'sam-memoryNY';

// Skapa en HTTP-förfrågan
const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/api/memory/conversation/${conversationID}`,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

// Skicka förfrågan
const req = http.request(options, (res) => {
  console.log(`Statuskod: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Konversationsdata:');
    console.log(JSON.parse(data));
  });
});

req.on('error', (e) => {
  console.error(`Problem med förfrågan: ${e.message}`);
});

req.end();

console.log(`Hämtar konversation med ID: ${conversationID}...`); 