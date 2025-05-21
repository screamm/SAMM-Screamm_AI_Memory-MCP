/**
 * SAM MCP Server
 * 
 * En MCP-server som integrerar med minnesservern för att ge Cursor
 * möjlighet att använda tidigare konversationer som kontext.
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const http = require('http');

// Konfigurera loggning
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirpSync(logDir);
}

// Loggfunktion för diagnostik
function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [INFO] ${message}\n`;
  
  try {
    fs.appendFileSync(path.join(logDir, 'mcp.log'), logMessage);
    console.error(logMessage.trim());
  } catch (err) {
    console.error(`Kunde inte skriva till loggfil: ${err.message}`);
  }
}

// Funktion för att göra HTTP-förfrågan till minnesservern
async function fetchMemory(endpoint, method = 'GET', data = null) {
  const MEMORY_SERVER = process.env.MCP_MEMORY_SERVER || 'http://localhost:3000';
  const url = `${MEMORY_SERVER}/api/memory/${endpoint}`;
  
  return new Promise((resolve, reject) => {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const requestLib = url.startsWith('https') ? https : http;
    const req = requestLib.request(url, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonData = JSON.parse(responseData);
            resolve(jsonData);
          } catch (error) {
            reject(new Error(`Kunde inte tolka svaret: ${error.message}`));
          }
        } else {
          reject(new Error(`HTTP-fel ${res.statusCode}: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`HTTP-förfrågan misslyckades: ${error.message}`));
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Skapa MCP-server
const server = new McpServer({
  name: 'SAM-Memory',
  version: '1.0.0',
  protocolVersion: '2025-03-26'
});

logToFile('MCP-server initialiserad');

// Lägg till verktyg för att hämta relevanta konversationer
server.tool(
  'get-relevant-conversations',
  {
    query: z.string().describe('Frågan eller ämnet att söka efter relaterade konversationer för'),
    maxResults: z.number().optional().describe('Maximalt antal konversationer att returnera')
  },
  async ({ query, maxResults = 3 }) => {
    try {
      logToFile(`Hämtar relevanta konversationer för: ${query}`);
      
      const result = await fetchMemory(`relevant?query=${encodeURIComponent(query)}&limit=${maxResults}`);
      
      if (!result || !result.conversations || result.conversations.length === 0) {
        return {
          content: [{ type: 'text', text: 'Inga relevanta tidigare konversationer hittades.' }]
        };
      }
      
      // Omvandla till läsbart format
      const conversationsText = result.conversations.map((conv, index) => {
        const messages = conv.messages.map(m => `${m.role}: ${m.content}`).join('\n');
        return `[KONVERSATION ${index + 1}]\n${messages}\n`;
      }).join('\n');
      
      return {
        content: [{ 
          type: 'text', 
          text: `Relaterade tidigare konversationer:\n\n${conversationsText}`
        }]
      };
    } catch (error) {
      logToFile(`Fel vid hämtning av relevanta konversationer: ${error.message}`);
      return {
        content: [{ 
          type: 'text', 
          text: `Kunde inte hämta relevanta konversationer: ${error.message}`
        }]
      };
    }
  }
);

// Lägg till verktyg för att spara en konversation
server.tool(
  'save-conversation',
  {
    id: z.string().optional().describe('Konversationsid, genereras om den inte anges'),
    messages: z.array(
      z.object({
        role: z.string(),
        content: z.string()
      })
    ).describe('Meddelandena i konversationen'),
    metadata: z.object({
      title: z.string().optional(),
      tags: z.array(z.string()).optional(),
      projectPath: z.string().optional()
    }).optional().describe('Metadata för konversationen')
  },
  async ({ id, messages, metadata }) => {
    try {
      logToFile(`Sparar konversation med ${messages.length} meddelanden`);
      
      const data = {
        id,
        messages,
        metadata: metadata || {}
      };
      
      const result = await fetchMemory('conversation', 'POST', data);
      
      return {
        content: [{ 
          type: 'text', 
          text: `Konversation sparad med ID: ${result.id}`
        }]
      };
    } catch (error) {
      logToFile(`Fel vid sparande av konversation: ${error.message}`);
      return {
        content: [{ 
          type: 'text', 
          text: `Kunde inte spara konversationen: ${error.message}`
        }]
      };
    }
  }
);

// Lägg till verktyg för att hämta en enskild konversation
server.tool(
  'get-conversation',
  {
    id: z.string().describe('ID för konversationen att hämta')
  },
  async ({ id }) => {
    try {
      logToFile(`Hämtar konversation med ID: ${id}`);
      
      const result = await fetchMemory(`conversation/${id}`);
      
      if (!result) {
        return {
          content: [{ type: 'text', text: `Ingen konversation hittad med ID: ${id}` }]
        };
      }
      
      // Omvandla till läsbart format
      const messages = result.messages.map(m => `${m.role}: ${m.content}`).join('\n');
      
      return {
        content: [{ 
          type: 'text', 
          text: `Konversation ${id}:\n\n${messages}`
        }]
      };
    } catch (error) {
      logToFile(`Fel vid hämtning av konversation: ${error.message}`);
      return {
        content: [{ 
          type: 'text', 
          text: `Kunde inte hämta konversationen: ${error.message}`
        }]
      };
    }
  }
);

// Lägg till resurs för minnesstatistik
server.resource(
  'memory-stats',
  'sam://memory-stats',
  async () => {
    try {
      logToFile('Hämtar minnesstatistik');
      
      const result = await fetchMemory('stats');
      
      return {
        contents: [{
          uri: 'sam://memory-stats',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      logToFile(`Fel vid hämtning av minnesstatistik: ${error.message}`);
      return {
        contents: [{
          uri: 'sam://memory-stats',
          text: `Kunde inte hämta minnesstatistik: ${error.message}`
        }]
      };
    }
  }
);

// Starta servern
async function startServer() {
  try {
    logToFile('Startar MCP-servern med STDIO-transport');
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logToFile('MCP-server ansluten och redo');
    
    // Skicka periodiska livstecken
    setInterval(() => {
      logToFile('MCP-server körs fortfarande');
    }, 60000);
    
  } catch (error) {
    logToFile(`FEL vid serverstart: ${error.message}`);
    process.exit(1);
  }
}

// Körning som huvudmodul
if (require.main === module) {
  logToFile('mcp-server.js körs som huvudmodul.');
  startServer().catch(err => {
    logToFile(`Okänt fel vid serverstart: ${err.message}`);
    process.exit(1);
  });
} else {
  // Exportera för användning i andra moduler
  module.exports = {
    startServer
  };
} 