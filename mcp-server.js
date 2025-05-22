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
const crypto = require('crypto');

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

// Funktion för att automatiskt spara konversationer
// Denna funktion anropas av MCP-servern efter varje interaktion
let currentConversation = { messages: [], hasUser: false, hasAssistant: false };
let conversationId = null;

// Generera ett unikt ID för konversationen
function generateConversationId() {
  return `conv-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

// Spara meddelande och kontrollera om vi ska spara konversationen
async function trackMessage(message) {
  try {
    if (message && typeof message === 'object') {
      // Hantera LLM-förfrågningar och svar
      if (message.type === 'request' && message.data && message.data.messages) {
        // Först sätter vi ett nytt konversations-ID om vi inte har ett
        if (!conversationId) {
          conversationId = generateConversationId();
          currentConversation = { messages: [], hasUser: false, hasAssistant: false };
          logToFile(`Ny konversation startad med ID: ${conversationId}`);
        }
        
        // Lägg till alla meddelanden i konversationen
        for (const msg of message.data.messages) {
          if (msg.role && msg.content) {
            currentConversation.messages.push({
              role: msg.role,
              content: msg.content,
              timestamp: new Date().toISOString()
            });
            
            if (msg.role === 'user') {
              currentConversation.hasUser = true;
            } else if (msg.role === 'assistant') {
              currentConversation.hasAssistant = true;
            }
          }
        }
      } else if (message.type === 'response' && message.data && message.data.message) {
        // För LLM-svar, lägg till assistentens meddelande
        const msg = message.data.message;
        if (msg.role && msg.content) {
          currentConversation.messages.push({
            role: msg.role,
            content: msg.content,
            timestamp: new Date().toISOString()
          });
          
          if (msg.role === 'assistant') {
            currentConversation.hasAssistant = true;
            
            // Assistenten har svarat, så vi kan spara konversationen
            if (currentConversation.hasUser && currentConversation.hasAssistant) {
              await saveCurrentConversation();
            }
          }
        }
      }
    }
  } catch (error) {
    logToFile(`Fel vid spårning av meddelande: ${error.message}`);
  }
}

// Spara aktuell konversation till minnesservern
async function saveCurrentConversation() {
  try {
    if (!currentConversation.messages || currentConversation.messages.length === 0) {
      return;
    }
    
    // Extrahera den första user-frågan för att använda som titel
    const firstUserMessage = currentConversation.messages.find(msg => msg.role === 'user');
    const title = firstUserMessage 
      ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
      : `Konversation ${conversationId}`;
    
    // Förbered data för att spara
    const data = {
      id: conversationId,
      messages: currentConversation.messages,
      metadata: {
        title,
        tags: ['auto-sparad'],
        timestamp: new Date().toISOString()
      }
    };
    
    // Skicka till minnesservern
    const result = await fetchMemory('conversation', 'POST', data);
    logToFile(`Konversation automatiskt sparad med ID: ${result.id} (${currentConversation.messages.length} meddelanden)`);
    
    // Återställ efter sparande
    conversationId = null;
    currentConversation = { messages: [], hasUser: false, hasAssistant: false };
    
    return result.id;
  } catch (error) {
    logToFile(`Fel vid sparande av konversation: ${error.message}`);
    return null;
  }
}

// Periodiskt spara konversationen om den har varit inaktiv ett tag
let lastActivity = Date.now();
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minuter

function checkInactivity() {
  const now = Date.now();
  if (now - lastActivity > INACTIVITY_TIMEOUT) {
    if (currentConversation.hasUser && currentConversation.hasAssistant) {
      saveCurrentConversation()
        .then(id => {
          if (id) logToFile(`Konversation sparad efter inaktivitet med ID: ${id}`);
        })
        .catch(err => logToFile(`Kunde inte spara konversation efter inaktivitet: ${err.message}`));
    }
  }
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

// Lyssna på serverhändelser för att spåra kommunikation
server.addListener('receivedMessage', message => {
  lastActivity = Date.now();
  trackMessage(message)
    .catch(err => logToFile(`Fel vid hantering av mottaget meddelande: ${err.message}`));
});

server.addListener('sentMessage', message => {
  lastActivity = Date.now();
  trackMessage(message)
    .catch(err => logToFile(`Fel vid hantering av skickat meddelande: ${err.message}`));
});

// Starta servern
async function startServer() {
  try {
    logToFile('Startar MCP-servern med STDIO-transport och automatisk konversationssparning');
    
    // Skapa och anslut transportlagret
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logToFile('MCP-server ansluten och redo med automatisk konversationssparning aktiverad');
    
    // Skicka periodiska livstecken och kontrollera inaktivitet
    setInterval(() => {
      logToFile('MCP-server körs fortfarande');
      checkInactivity();
    }, 60000); // Varje minut
    
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