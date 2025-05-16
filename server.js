const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');
const cors = require('cors');
const natural = require('natural');
const os = require('os');
const osUtils = require('os-utils');

const app = express();
const PORT = process.env.PORT || 3000;
const MEMORY_DIR = path.join(__dirname, 'memory');
const startTime = new Date();

// Säkerställ att minnesmappen finns
if (!fs.existsSync(MEMORY_DIR)) {
  fsExtra.mkdirpSync(MEMORY_DIR);
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Datastruktur för minne
const memoryStore = {
  conversations: {},
  contextualKnowledge: {},
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

// Starta servern
app.listen(PORT, () => {
  console.log(`Memory Control Process server körs på port ${PORT}`);
}); 