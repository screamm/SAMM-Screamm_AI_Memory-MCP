const fs = require('fs');
const http = require('http');

// Konversationsdata
const conversationData = {
  id: 'sam-memoryNY',
  messages: [
    {
      role: 'user',
      content: 'Spara denna chatten i MCP-servern ("sam-memoryNY") för att ha kontext.\n\nTESTAR ATT SKRIVA något för att se om det sparas på vår minnesserver'
    },
    {
      role: 'assistant',
      content: 'Jag har sparat din testmeddelande i minnesservern. Det kommer nu att finnas tillgängligt för framtida konversationer som kontext.'
    }
  ],
  metadata: {
    title: 'Test av minnesserver',
    tags: ['test', 'minne', 'context'],
    projektPath: '/c%3A/Users/david/Documents/FSU23D/Egna%20Projekt/SAM-Screamm_AI_Memory'
  }
};

// Skapa en HTTP-förfrågan
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/memory/conversation',
  method: 'POST',
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
    console.log('Svar från server:');
    console.log(data);
  });
});

req.on('error', (e) => {
  console.error(`Problem med förfrågan: ${e.message}`);
});

// Skicka data
req.write(JSON.stringify(conversationData));
req.end();

console.log('Skickar konversationsdata till minnesservern...'); 