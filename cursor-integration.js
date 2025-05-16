const CursorMemoryExtension = require('./cursor-memory-extension');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const os = require('os');

const app = express();
const PORT = 3100;
const memory = new CursorMemoryExtension('http://localhost:3000');
const startTime = new Date();

// Statistik för övervakning
const proxyStats = {
  totalRequests: 0,
  claudeRequests: 0,
  geminiRequests: 0,
  errors: 0,
  lastError: null
};

// Middleware
app.use(bodyParser.json());

// Status-endpoint för övervakning
app.get('/api/status', (req, res) => {
  proxyStats.totalRequests++;
  
  // Beräkna uppetid
  const uptime = Date.now() - startTime.getTime();
  const formattedUptime = {
    days: Math.floor(uptime / (1000 * 60 * 60 * 24)),
    hours: Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((uptime % (1000 * 60)) / 1000)
  };
  
  // Hämta minnesanvändning
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = Math.round((usedMemory / totalMemory) * 100);
  
  // Kontrollera om memory-servern är tillgänglig
  let memoryServerStatus = 'unknown';
  axios.get(memory.baseUrl + '/api/status')
    .then(() => { memoryServerStatus = 'connected'; })
    .catch(() => { memoryServerStatus = 'disconnected'; })
    .finally(() => {
      res.json({
        status: 'online',
        version: '1.0.0',
        startTime: startTime.toISOString(),
        uptime: formattedUptime,
        stats: {
          totalRequests: proxyStats.totalRequests,
          claudeRequests: proxyStats.claudeRequests,
          geminiRequests: proxyStats.geminiRequests,
          errors: proxyStats.errors,
          lastError: proxyStats.lastError
        },
        connections: {
          memoryServer: {
            url: memory.baseUrl,
            status: memoryServerStatus
          },
          currentConversation: memory.currentConversationId || 'none'
        },
        system: {
          platform: os.platform(),
          hostname: os.hostname(),
          memoryUsage: `${memoryUsage}%`,
          nodeVersion: process.version
        }
      });
    });
});

// Lokal proxy för Claude AI-anrop
app.post('/proxy/claude', async (req, res) => {
  try {
    proxyStats.totalRequests++;
    proxyStats.claudeRequests++;
    
    // Extrahera prompt från Cursor-anropet
    const { prompt, options } = req.body;
    
    // Starta en ny konversation om det behövs
    if (!memory.currentConversationId) {
      await memory.startNewConversation('claude', { 
        cursorSessionId: options?.sessionId || 'unknown'
      });
    }
    
    // Förbättra prompten med tidigare kontext
    const enhancedPrompt = await memory.enhancePrompt(prompt);
    
    // Lägg till användarens meddelande i konversationen
    await memory.addMessage('user', prompt);
    
    // Vidarebefordra till den faktiska Claude-endpointen
    // OBS: Detta är ett exempel - du behöver anpassa till verkliga Cursor-API:et
    // I en verklig implementering skulle detta anropa Cursor's interna API
    const claudeResponse = await axios.post('https://cursor-internal-api/claude', {
      prompt: enhancedPrompt,
      options
    }).catch(err => {
      console.log('Simulerar Claude API-anrop eftersom vi inte har direkt tillgång till Cursor-API:et');
      // Simulera ett svar då vi inte har direkt tillgång till Cursor's API
      return { 
        data: { 
          response: `Detta är ett simulerat svar från Claude baserat på din fråga: "${prompt}"` 
        } 
      };
    });
    
    // Extrahera svar från Claude
    const assistantResponse = claudeResponse.data.response;
    
    // Spara assistentens svar i konversationen
    await memory.addMessage('assistant', assistantResponse);
    
    // Extrahera viktig kunskap från svaret
    await memory.extractAndSaveKnowledge(assistantResponse);
    
    // Returnera svaret till Cursor
    res.json(claudeResponse.data);
  } catch (error) {
    console.error('Proxy-fel:', error);
    proxyStats.errors++;
    proxyStats.lastError = {
      message: error.message,
      endpoint: '/proxy/claude',
      time: new Date().toISOString()
    };
    res.status(500).json({ error: 'Ett fel uppstod vid proxying' });
  }
});

// Liknande endpoints för Google Gemini
app.post('/proxy/gemini', async (req, res) => {
  try {
    proxyStats.totalRequests++;
    proxyStats.geminiRequests++;
    
    // Extrahera prompt från Cursor-anropet
    const { prompt, options } = req.body;
    
    // Starta en ny konversation om det behövs
    if (!memory.currentConversationId) {
      await memory.startNewConversation('gemini', { 
        cursorSessionId: options?.sessionId || 'unknown'
      });
    }
    
    // Förbättra prompten med tidigare kontext
    const enhancedPrompt = await memory.enhancePrompt(prompt);
    
    // Lägg till användarens meddelande i konversationen
    await memory.addMessage('user', prompt);
    
    // Simulera anrop till Gemini
    console.log('Simulerar Gemini API-anrop eftersom vi inte har direkt tillgång till Cursor-API:et');
    const geminiResponse = {
      data: {
        response: `Detta är ett simulerat svar från Gemini baserat på din fråga: "${prompt}"`
      }
    };
    
    // Extrahera svar från Gemini
    const assistantResponse = geminiResponse.data.response;
    
    // Spara assistentens svar i konversationen
    await memory.addMessage('assistant', assistantResponse);
    
    // Extrahera viktig kunskap från svaret
    await memory.extractAndSaveKnowledge(assistantResponse);
    
    // Returnera svaret till Cursor
    res.json(geminiResponse.data);
  } catch (error) {
    console.error('Proxy-fel:', error);
    proxyStats.errors++;
    proxyStats.lastError = {
      message: error.message,
      endpoint: '/proxy/gemini',
      time: new Date().toISOString()
    };
    res.status(500).json({ error: 'Ett fel uppstod vid proxying' });
  }
});

// Enkel statussida
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Cursor Memory Integration</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          .status { padding: 10px; background-color: #e6f7ff; border-radius: 5px; }
          .endpoints { margin-top: 20px; }
          .endpoint { background-color: #f5f5f5; padding: 10px; margin-bottom: 10px; border-radius: 5px; }
          code { background-color: #f0f0f0; padding: 2px 4px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>Cursor Memory Integration</h1>
        <div class="status">
          <p>Status: <strong>Aktiv</strong></p>
          <p>Proxy körs på port: <strong>${PORT}</strong></p>
          <p>Ansluten till minnesserver: <strong>${memory.baseUrl}</strong></p>
          <p>Uppetid: <strong>${formatUptime(startTime)}</strong></p>
          <p>Totalt antal anrop: <strong>${proxyStats.totalRequests}</strong></p>
        </div>
        <div class="endpoints">
          <h2>Tillgängliga endpoints:</h2>
          <div class="endpoint">
            <h3>Claude AI Proxy</h3>
            <p><code>POST /proxy/claude</code></p>
            <p>Kropp: <code>{ "prompt": "Din fråga", "options": {} }</code></p>
          </div>
          <div class="endpoint">
            <h3>Gemini AI Proxy</h3>
            <p><code>POST /proxy/gemini</code></p>
            <p>Kropp: <code>{ "prompt": "Din fråga", "options": {} }</code></p>
          </div>
          <div class="endpoint">
            <h3>Status API</h3>
            <p><code>GET /api/status</code></p>
            <p>Returnerar detaljerad statusinformation om proxyn</p>
          </div>
        </div>
        <p><a href="/dashboard">Öppna övervakningssidan</a></p>
      </body>
    </html>
  `);
});

// Hjälpfunktion för att formatera uppetid
function formatUptime(startTime) {
  const uptime = Date.now() - startTime.getTime();
  const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${days}d ${hours}h ${minutes}m`;
}

// Omdirigera till övervakningssidan
app.get('/dashboard', (req, res) => {
  res.redirect('http://localhost:3000/dashboard');
});

// Starta servern
app.listen(PORT, () => {
  console.log(`Cursor integration proxy körs på port ${PORT}`);
}); 