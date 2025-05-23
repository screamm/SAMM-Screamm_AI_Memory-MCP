const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');
const cors = require('cors');
const natural = require('natural');
const os = require('os');
const osUtils = require('os-utils');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const MEMORY_DIR = path.join(__dirname, 'memory');
const LOG_DIR = path.join(__dirname, 'logs');
const startTime = new Date();

// Säkerställ att minnesmappen finns
if (!fs.existsSync(MEMORY_DIR)) {
  fsExtra.mkdirpSync(MEMORY_DIR);
}

// Säkerställ att loggmappen finns
if (!fs.existsSync(LOG_DIR)) {
  fsExtra.mkdirpSync(LOG_DIR);
}

// Loggfunktion
function logToFile(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}\n`;
  fs.appendFileSync(path.join(LOG_DIR, 'server.log'), logMessage);
  console.log(logMessage.trim());
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Aktivt spår av de pågående konversationerna (för att automatiskt spara)
// Nyckeln är en unik ID för varje konversationsflöde
const activeConversations = {};

// MCP-förfrågningar middleware
app.use((req, res, next) => {
  // Logga alla inkommande förfrågningar
  logToFile(`${req.method} ${req.url}`, 'REQUEST');

  // Automatisk konversationssparning
  if (req.method === 'POST' && req.body && req.body.messages && Array.isArray(req.body.messages)) {
    const convId = req.body.conversation_id || `auto-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const messages = req.body.messages;

    logToFile(`Hittade en konversation med ${messages.length} meddelanden: ${convId}`, 'AUTO-SAVE');

    // Spara konversationen direkt
    setTimeout(() => {
      try {
        // Bara spara om det finns minst ett användarmeddelande
        const hasUserMessage = messages.some(m => m.role === 'user');
        
        if (hasUserMessage) {
          // Skapa metadata
          const metadata = {
            title: messages.find(m => m.role === 'user')?.content?.substring(0, 50) || `Konversation ${convId}`,
            tags: ['auto-sparad'],
            source: 'express-middleware',
            savedAt: new Date().toISOString()
          };

          // Spara till minneslagret
          memoryStore.conversations[convId] = {
            id: convId,
            messages: messages.map(msg => ({
              ...msg,
              timestamp: msg.timestamp || new Date().toISOString()
            })),
            metadata,
            lastUpdated: new Date().toISOString()
          };

          memoryStore.saveToDisk();
          logToFile(`Sparade konversation automatiskt: ${convId} (${messages.length} meddelanden)`, 'AUTO-SAVE');
        } else {
          logToFile(`Hoppade över konversation utan användarmeddelande: ${convId}`, 'AUTO-SAVE');
        }
      } catch (error) {
        logToFile(`Fel vid automatisk sparning: ${error.message}`, 'ERROR');
      }
    }, 0);
  }

  // Fortsätt till nästa middleware
  next();
});

// Rensa gamla inaktiva konversationer regelbundet
setInterval(() => {
  const now = Date.now();
  const timeout = 10 * 60 * 1000; // 10 minuter
  
  for (const [id, conv] of Object.entries(activeConversations)) {
    // Spara konversationen om den har varit inaktiv länge
    if (now - conv.lastActivity > timeout) {
      if (conv.hasUser && conv.hasAssistant && conv.messages.length >= 2) {
        // Spara till minneslagret
        memoryStore.conversations[id] = {
          id,
          messages: conv.messages,
          metadata: conv.metadata,
          lastUpdated: new Date().toISOString()
        };
        
        memoryStore.saveToDisk();
        console.log(`Konversation sparad efter inaktivitet med ID: ${id} (${conv.messages.length} meddelanden)`);
      }
      
      // Ta bort från aktiva konversationer
      delete activeConversations[id];
    }
  }
}, 60000); // Kontrollera varje minut

// Datastruktur för minne
const memoryStore = {
  conversations: {},
  contextualKnowledge: {},
  genericMemoryItems: {}, // Ny datastore för generiska minnesobjekt
  loadFromDisk() {
    try {
      if (fs.existsSync(path.join(MEMORY_DIR, 'conversations.json'))) {
        this.conversations = JSON.parse(
          fs.readFileSync(path.join(MEMORY_DIR, 'conversations.json'), 'utf8')
        );
      }
      if (fs.existsSync(path.join(MEMORY_DIR, 'knowledge.json'))) {
        this.contextualKnowledge = JSON.parse(
          fs.readFileSync(path.join(MEMORY_DIR, 'knowledge.json'), 'utf8')
        );
      }
      if (fs.existsSync(path.join(MEMORY_DIR, 'genericItems.json'))) { // Ladda generiska objekt
        this.genericMemoryItems = JSON.parse(
          fs.readFileSync(path.join(MEMORY_DIR, 'genericItems.json'), 'utf8')
        );
      }
    } catch (error) {
      console.error('Fel vid laddning av minne:', error);
    }
  },
  saveToDisk() {
    try {
      fs.writeFileSync(
        path.join(MEMORY_DIR, 'conversations.json'),
        JSON.stringify(this.conversations, null, 2)
      );
      fs.writeFileSync(
        path.join(MEMORY_DIR, 'knowledge.json'),
        JSON.stringify(this.contextualKnowledge, null, 2)
      );
      fs.writeFileSync( // Spara generiska objekt
        path.join(MEMORY_DIR, 'genericItems.json'),
        JSON.stringify(this.genericMemoryItems, null, 2)
      );
    } catch (error) {
      console.error('Fel vid sparande av minne:', error);
    }
  }
};

// Håll koll på statistik
const serverStats = {
  apiRequests: 0,
  errors: 0,
  lastError: null
};

// Hjälpfunktion för förbättrad relevanssökning
function findRelevantConversations(query, conversations, maxResults = 5) {
  const tfidf = new natural.TfIdf();
  
  // Lägg till alla konversationer i TF-IDF
  Object.values(conversations).forEach((conv, idx) => {
    const text = conv.messages.map(m => m.content).join(' ');
    tfidf.addDocument(text, idx);
  });
  
  // Hitta de mest relevanta dokumenten för frågan
  const results = [];
  tfidf.tfidfs(query, function(idx, measure) {
    if (idx < Object.values(conversations).length) {
      results.push({ 
        index: idx, 
        score: measure,
        conversation: Object.values(conversations)[idx]
      });
    }
  });
  
  // Sortera efter relevans och returnera de bästa träffarna
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(r => r.conversation);
}

// Ladda befintligt minne vid uppstart
memoryStore.loadFromDisk();

// API-rutter

// Rut för webbgränssnittet
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rut för övervakningsgränssnittet
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Status-endpoint för övervakning
app.get('/api/status', (req, res) => {
  serverStats.apiRequests++;
  
  // Beräkna systemresurser
  const uptime = Date.now() - startTime.getTime();
  const formattedUptime = {
    days: Math.floor(uptime / (1000 * 60 * 60 * 24)),
    hours: Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((uptime % (1000 * 60)) / 1000)
  };
  
  // Hämta information om minnesanvändning
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = Math.round((usedMemory / totalMemory) * 100);
  
  // CPU-information
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'Okänd';
  const cpuCores = cpus.length;
  
  // Hämta CPU-belastning med os-utils
  osUtils.cpuUsage(function(cpuUsage) {
    // Diskutrymme är inte lätt att få tag på i Node utan extra bibliotek,
    // så vi simulerar detta värde för demonstrations syfte
    const diskSpace = {
      total: '500GB',
      free: '350GB',
      usage: '30%'
    };
    
    // Hämta processinformation
    const processMemoryUsage = process.memoryUsage();
    
    res.json({
      status: 'online',
      version: '1.0.0',
      startTime: startTime.toISOString(),
      uptime: formattedUptime,
      stats: {
        conversations: Object.keys(memoryStore.conversations).length,
        knowledgeObjects: Object.keys(memoryStore.contextualKnowledge).length,
        apiRequests: serverStats.apiRequests,
        errors: serverStats.errors,
        lastError: serverStats.lastError
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        cpuModel,
        cpuCores,
        cpuUsage: `${Math.round(cpuUsage * 100)}%`,
        cpuLoadAvg: os.loadavg(),
        totalMemory,
        freeMemory,
        memoryUsage: `${memoryUsage}%`,
        processMemory: {
          rss: processMemoryUsage.rss,
          heapTotal: processMemoryUsage.heapTotal,
          heapUsed: processMemoryUsage.heapUsed,
          external: processMemoryUsage.external
        },
        diskSpace,
        nodeVersion: process.version
      }
    });
  });
});

// Spara en ny konversation eller uppdatera en befintlig
app.post('/api/memory/conversation', (req, res) => {
  serverStats.apiRequests++;
  const { id, messages, metadata } = req.body;
  
  if (!id || !messages) {
    return res.status(400).json({ error: 'ID och meddelanden krävs' });
  }
  
  memoryStore.conversations[id] = {
    id,
    messages,
    metadata: metadata || {},
    lastUpdated: new Date().toISOString()
  };
  
  memoryStore.saveToDisk();
  res.json({ success: true, id });
});

// Lägg till ett meddelande till en befintlig konversation
app.post('/api/memory/conversation/:id/message', (req, res) => {
  serverStats.apiRequests++;
  const { id } = req.params;
  const { role, content } = req.body;
  
  if (!memoryStore.conversations[id]) {
    return res.status(404).json({ error: 'Konversation hittades inte' });
  }
  
  if (!role || !content) {
    return res.status(400).json({ error: 'Roll och innehåll krävs' });
  }
  
  memoryStore.conversations[id].messages.push({
    role,
    content,
    timestamp: new Date().toISOString()
  });
  
  memoryStore.conversations[id].lastUpdated = new Date().toISOString();
  memoryStore.saveToDisk();
  
  res.json({ success: true });
});

// Hämta en specifik konversation
app.get('/api/memory/conversation/:id', (req, res) => {
  serverStats.apiRequests++;
  const { id } = req.params;
  
  if (!memoryStore.conversations[id]) {
    return res.status(404).json({ error: 'Konversation hittades inte' });
  }
  
  res.json(memoryStore.conversations[id]);
});

// Hämta alla konversationer (med paginering)
app.get('/api/memory/conversations', (req, res) => {
  serverStats.apiRequests++;
  const { page = 1, limit = 10 } = req.query;
  const conversationIds = Object.keys(memoryStore.conversations);
  
  const startIdx = (page - 1) * limit;
  const endIdx = startIdx + parseInt(limit);
  
  const paginatedIds = conversationIds.slice(startIdx, endIdx);
  const paginatedConversations = paginatedIds.map(id => ({
    id,
    metadata: memoryStore.conversations[id].metadata,
    lastUpdated: memoryStore.conversations[id].lastUpdated,
    messageCount: memoryStore.conversations[id].messages.length
  }));
  
  res.json({
    total: conversationIds.length,
    page: parseInt(page),
    limit: parseInt(limit),
    conversations: paginatedConversations
  });
});

// Lägg till kontextuell kunskap
app.post('/api/memory/knowledge', (req, res) => {
  serverStats.apiRequests++;
  const { key, data, metadata } = req.body;
  
  if (!key || !data) {
    return res.status(400).json({ error: 'Nyckel och data krävs' });
  }
  
  memoryStore.contextualKnowledge[key] = {
    data,
    metadata: metadata || {},
    lastUpdated: new Date().toISOString()
  };
  
  memoryStore.saveToDisk();
  res.json({ success: true, key });
});

// Hämta specifik kontextuell kunskap
app.get('/api/memory/knowledge/:key', (req, res) => {
  serverStats.apiRequests++;
  const { key } = req.params;
  
  if (!memoryStore.contextualKnowledge[key]) {
    return res.status(404).json({ error: 'Kunskap hittades inte' });
  }
  
  res.json(memoryStore.contextualKnowledge[key]);
});

// Hämta all kontextuell kunskap
app.get('/api/memory/knowledge', (req, res) => {
  serverStats.apiRequests++;
  res.json(Object.keys(memoryStore.contextualKnowledge).map(key => ({
    key,
    metadata: memoryStore.contextualKnowledge[key].metadata,
    lastUpdated: memoryStore.contextualKnowledge[key].lastUpdated,
    preview: typeof memoryStore.contextualKnowledge[key].data === 'string'
      ? memoryStore.contextualKnowledge[key].data.substring(0, 100)
      : JSON.stringify(memoryStore.contextualKnowledge[key].data).substring(0, 100)
  })));
});

// Hämta relevant kontextuell kunskap baserat på sökfråga
app.get('/api/memory/search', (req, res) => {
  serverStats.apiRequests++;
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Sökfråga krävs' });
  }
  
  // Enkel sökning - i produktion skulle detta vara mer sofistikerat
  const results = [];
  
  // Sök i konversationer
  Object.values(memoryStore.conversations).forEach(conv => {
    if (JSON.stringify(conv).toLowerCase().includes(query.toLowerCase())) {
      results.push({
        type: 'conversation',
        id: conv.id,
        preview: conv.messages.slice(-1)[0]?.content || '',
        lastUpdated: conv.lastUpdated
      });
    }
  });
  
  // Sök i kontextuell kunskap
  Object.entries(memoryStore.contextualKnowledge).forEach(([key, value]) => {
    if (
      key.toLowerCase().includes(query.toLowerCase()) ||
      JSON.stringify(value.data).toLowerCase().includes(query.toLowerCase())
    ) {
      results.push({
        type: 'knowledge',
        key,
        preview: typeof value.data === 'string' 
          ? value.data.substring(0, 100) 
          : JSON.stringify(value.data).substring(0, 100),
        lastUpdated: value.lastUpdated
      });
    }
  });
  
  res.json({ results });
});

// Generera kontext för en ny AI-konversation
app.post('/api/memory/generate-context', (req, res) => {
  serverStats.apiRequests++;
  const { query, maxItems = 5 } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Sökfråga krävs' });
  }
  
  // Hitta relevanta konversationer med TF-IDF
  const relevantConversations = findRelevantConversations(
    query, 
    memoryStore.conversations,
    maxItems
  );
  
  const relevantKnowledge = [];
  
  // Hitta relevant kunskap
  Object.entries(memoryStore.contextualKnowledge).forEach(([key, value]) => {
    if (
      key.toLowerCase().includes(query.toLowerCase()) ||
      JSON.stringify(value.data).toLowerCase().includes(query.toLowerCase())
    ) {
      relevantKnowledge.push({
        key,
        data: value.data
      });
    }
  });
  
  // Skapa kontextprompt
  const contextItems = [
    ...relevantConversations.slice(0, maxItems),
    ...relevantKnowledge.slice(0, maxItems)
  ];
  
  const contextPrompt = `
    Relevant tidigare kunskap:
    ${contextItems.map((item, i) => {
      if ('messages' in item) {
        return `Konversation ${i+1}:\n${item.messages.map(m => 
          `${m.role}: ${m.content}`).join('\n')}`;
      } else {
        return `Kunskap: ${item.key}\n${
          typeof item.data === 'string' 
            ? item.data 
            : JSON.stringify(item.data, null, 2)
        }`;
      }
    }).join('\n\n')}
  `;
  
  res.json({ 
    contextPrompt,
    sources: {
      conversations: relevantConversations.map(c => c.id),
      knowledge: relevantKnowledge.map(k => k.key)
    }
  });
});

// Radera en konversation
app.delete('/api/memory/conversation/:id', (req, res) => {
  serverStats.apiRequests++;
  const { id } = req.params;
  
  if (!memoryStore.conversations[id]) {
    return res.status(404).json({ error: 'Konversation hittades inte' });
  }
  
  delete memoryStore.conversations[id];
  memoryStore.saveToDisk();
  
  res.json({ success: true });
});

// Radera kontextuell kunskap
app.delete('/api/memory/knowledge/:key', (req, res) => {
  serverStats.apiRequests++;
  const { key } = req.params;
  
  if (!memoryStore.contextualKnowledge[key]) {
    return res.status(404).json({ error: 'Kunskap hittades inte' });
  }
  
  delete memoryStore.contextualKnowledge[key];
  memoryStore.saveToDisk();
  
  res.json({ success: true });
});

// API-rutter för generiska minnesobjekt (CRUD)

// MCP-test endpoint för att simulera en MCP-förfrågan
app.post('/api/mcp-test-completion', (req, res) => {
  serverStats.apiRequests++;
  
  logToFile(`Tog emot en MCP-testförfrågan`, 'MCP-TEST');
  
  const { messages } = req.body;
  
  if (!messages || !Array.isArray(messages)) {
    serverStats.errors++;
    serverStats.lastError = 'Meddelanden krävs och måste vara en array';
    return res.status(400).json({ error: 'Meddelanden krävs och måste vara en array' });
  }
  
  logToFile(`Antal meddelanden i förfrågan: ${messages.length}`, 'MCP-TEST');
  
  // Simulera ett LLM-svar
  const assistantMessage = {
    role: 'assistant',
    content: 'Detta är ett automatiskt genererat svar från en simulerad MCP-förfrågan. Din förfrågan har sparats automatiskt i minnesservern.'
  };
  
  // Lägg till assistentens svar i meddelanden innan middleware körs
  req.body.messages = [...messages, assistantMessage];
  
  // Skapa ett konversations-ID om det inte finns
  if (!req.body.conversation_id) {
    req.body.conversation_id = `test-conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }
  
  logToFile(`Genererade svar med konversations-ID: ${req.body.conversation_id}`, 'MCP-TEST');
  
  // Skicka svar
  res.json({
    message: assistantMessage,
    conversation_id: req.body.conversation_id
  });
  
  logToFile(`MCP-test-förfrågan bearbetad med ${messages.length} meddelanden, totalt ${req.body.messages.length} efter svar`, 'MCP-TEST');
});

// Skapa ett nytt generiskt minnesobjekt
app.post('/api/memory/item', (req, res) => {
  serverStats.apiRequests++;
  const { id, content, type, metadata } = req.body;

  if (!id || !content) {
    serverStats.errors++;
    serverStats.lastError = 'ID och content krävs för att skapa ett minnesobjekt.';
    return res.status(400).json({ error: 'ID och content krävs' });
  }

  if (memoryStore.genericMemoryItems[id]) {
    serverStats.errors++;
    serverStats.lastError = `Minnesobjekt med ID ${id} finns redan.`;
    return res.status(409).json({ error: 'Objekt med detta ID finns redan' });
  }

  memoryStore.genericMemoryItems[id] = {
    id,
    content,
    type: type || 'generic',
    metadata: metadata || {},
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString()
  };

  memoryStore.saveToDisk();
  res.status(201).json({ success: true, id });
});

// Hämta ett specifikt generiskt minnesobjekt
app.get('/api/memory/item/:id', (req, res) => {
  serverStats.apiRequests++;
  const { id } = req.params;

  if (!memoryStore.genericMemoryItems[id]) {
    serverStats.errors++;
    serverStats.lastError = `Minnesobjekt med ID ${id} hittades inte.`;
    return res.status(404).json({ error: 'Minnesobjekt hittades inte' });
  }

  res.json(memoryStore.genericMemoryItems[id]);
});

// Uppdatera ett befintligt generiskt minnesobjekt
app.put('/api/memory/item/:id', (req, res) => {
  serverStats.apiRequests++;
  const { id } = req.params;
  const { content, type, metadata } = req.body;

  if (!memoryStore.genericMemoryItems[id]) {
    serverStats.errors++;
    serverStats.lastError = `Minnesobjekt med ID ${id} hittades inte för uppdatering.`;
    return res.status(404).json({ error: 'Minnesobjekt hittades inte' });
  }

  // Behåll befintliga värden om de inte anges i request body
  const itemToUpdate = memoryStore.genericMemoryItems[id];
  itemToUpdate.content = content !== undefined ? content : itemToUpdate.content;
  itemToUpdate.type = type !== undefined ? type : itemToUpdate.type;
  itemToUpdate.metadata = metadata !== undefined ? metadata : itemToUpdate.metadata;
  itemToUpdate.lastUpdatedAt = new Date().toISOString();

  memoryStore.genericMemoryItems[id] = itemToUpdate;
  memoryStore.saveToDisk();
  res.json({ success: true, id, updatedItem: itemToUpdate });
});

// Ta bort ett specifikt generiskt minnesobjekt
app.delete('/api/memory/item/:id', (req, res) => {
  serverStats.apiRequests++;
  const { id } = req.params;

  if (!memoryStore.genericMemoryItems[id]) {
    serverStats.errors++;
    serverStats.lastError = `Minnesobjekt med ID ${id} hittades inte för borttagning.`;
    return res.status(404).json({ error: 'Minnesobjekt hittades inte' });
  }

  delete memoryStore.genericMemoryItems[id];
  memoryStore.saveToDisk();
  res.json({ success: true, id });
});

// Hämta alla generiska minnesobjekt (med paginering och filtrering)
app.get('/api/memory/items', (req, res) => {
  serverStats.apiRequests++;
  let { page = 1, limit = 10, type } = req.query;
  page = parseInt(page);
  limit = parseInt(limit);

  let itemsArray = Object.values(memoryStore.genericMemoryItems);

  // Filtrera på typ om angivet
  if (type) {
    itemsArray = itemsArray.filter(item => item.type === type);
  }

  // Sortera efter senaste uppdatering (nyast först)
  itemsArray.sort((a, b) => new Date(b.lastUpdatedAt) - new Date(a.lastUpdatedAt));

  const totalItems = itemsArray.length;
  const totalPages = Math.ceil(totalItems / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedItems = itemsArray.slice(startIndex, endIndex);

  res.json({
    success: true,
    data: paginatedItems,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit
    }
  });
});

// Felhantering
app.use((err, req, res, next) => {
  console.error('Serverfel:', err);
  serverStats.errors++;
  serverStats.lastError = {
    message: err.message,
    stack: err.stack,
    time: new Date().toISOString()
  };
  res.status(500).json({ error: 'Ett serverfel uppstod' });
});

// Administration-endpoint för att starta/stoppa servrar
let serverProcesses = {
  mcp: null
};

app.post('/api/admin/start-servers', (req, res) => {
  serverStats.apiRequests++;
  
  try {
    const { mcpTools, mcpPort, memoryServerUrl, startMemoryServer } = req.body;
    
    // Kontrollera att alla nödvändiga parametrar finns
    if (!mcpTools || !mcpPort || !memoryServerUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Alla parametrar måste anges' 
      });
    }
    
    const { spawn } = require('child_process');
    
    // Starta MCP-servern om den inte redan körs
    if (serverProcesses.mcp) {
      // Avsluta befintlig process först om den finns
      serverProcesses.mcp.kill();
      serverProcesses.mcp = null;
    }
    
    // Konfigurera miljövariabler
    const env = {
      ...process.env,
      MCP_PORT: mcpPort,
      MCP_MEMORY_SERVER: memoryServerUrl,
      MCP_TOOLS: mcpTools
    };
    
    // Starta MCP-servern
    const mcpProcess = spawn('node', [path.join(__dirname, 'mcp-server.js')], {
      env,
      detached: true, // Kör i bakgrunden
      stdio: 'ignore' // Ignorera stdout/stderr för att förhindra blockering
    });
    
    // Spara referens till processen
    serverProcesses.mcp = mcpProcess;
    
    // Logga start
    console.log(`MCP-server startad på port ${mcpPort} med verktyg: ${mcpTools}`);
    
    res.json({ 
      success: true,
      message: `MCP-server startad på port ${mcpPort} med verktyg: ${mcpTools}`
    });
  } catch (error) {
    console.error('Fel vid start av servrar:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/admin/stop-servers', (req, res) => {
  serverStats.apiRequests++;
  
  try {
    // Stoppa MCP-servern om den körs
    if (serverProcesses.mcp) {
      serverProcesses.mcp.kill();
      serverProcesses.mcp = null;
      console.log('MCP-server stoppad');
    }
    
    res.json({ 
      success: true,
      message: 'Servrar stoppade'
    });
  } catch (error) {
    console.error('Fel vid stopp av servrar:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Starta servern
app.listen(PORT, () => {
  console.log(`Memory Control Process server körs på port ${PORT}`);
}); 