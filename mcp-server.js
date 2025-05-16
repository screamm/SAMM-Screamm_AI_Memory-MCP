const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const CursorMemoryExtension = require('./cursor-memory-extension');

// MCP-serverkonfiguration
const app = express();
const PORT = process.env.MCP_PORT || 3200;
const memory = new CursorMemoryExtension('http://localhost:3000');

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Hjälpfunktion för loggning
function logToFile(data, type = 'info') {
  const logDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}\n`;
  
  fs.appendFileSync(path.join(logDir, 'mcp.log'), logEntry);
}

// MCP huvudendpoint för att förbättra prompts med kontext
app.post('/mcp', async (req, res) => {
  try {
    logToFile(req.body, 'request');
    
    const { prompt, conversation_id, model, stream = false, options = {} } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        error: "Missing required parameter: 'prompt'" 
      });
    }
    
    // Använd befintlig konversation eller skapa en ny
    const convoId = conversation_id || `mcp-cursor-${Date.now()}`;
    
    // Skapa en ny konversation om det behövs
    if (memory.currentConversationId !== convoId) {
      try {
        // Försök att hitta en befintlig konversation
        await axios.get(`http://localhost:3000/api/memory/conversation/${convoId}`);
        memory.currentConversationId = convoId;
        const convoResponse = await axios.get(`http://localhost:3000/api/memory/conversation/${convoId}`);
        memory.conversationMessages = convoResponse.data.messages || [];
      } catch (error) {
        // Om konversationen inte finns, skapa en ny
        await memory.startNewConversation('cursor', { 
          conversationId: convoId,
          aiModel: model || 'unknown',
          source: 'mcp',
          ...options
        });
      }
    }
    
    // Förbättra prompten med relevant kontext från minnet
    const enhancedPrompt = await memory.enhancePrompt(prompt);
    
    // Lägg till användarfrågan i minnet
    await memory.addMessage('user', prompt);
    
    // Informera om hur mycket kontext som lagts till
    const contextSize = (enhancedPrompt.length - prompt.length);
    const percentageIncrease = prompt.length > 0 ? Math.round((contextSize / prompt.length) * 100) : 0;
    
    // Formatera svaret enligt MCP-protokollet
    const response = {
      id: `sam-mem-${Date.now()}`,
      object: "memory_enhancement",
      created: Math.floor(Date.now() / 1000),
      model: "sam-cursor-memory-v1",
      enhanced_prompt: enhancedPrompt,
      original_prompt: prompt,
      conversation_id: convoId,
      system_info: {
        memory_provider: "SAM-Screamm_AI_Memory",
        version: "1.0.0",
        context_used: enhancedPrompt !== prompt,
        context_tokens_approximate: Math.round(contextSize / 4), // Grov uppskattning av tokens
        memory_stats: {
          context_percentage: percentageIncrease,
          conversation_messages: memory.conversationMessages.length
        }
      }
    };
    
    logToFile(response, 'response');
    res.json(response);
    
  } catch (error) {
    console.error('MCP Server Error:', error);
    logToFile(error.message, 'error');
    res.status(500).json({ 
      error: 'Ett fel uppstod i MCP-servern',
      details: error.message 
    });
  }
});

// Endpoint för att ta emot och spara AI-svar
app.post('/mcp/response', async (req, res) => {
  try {
    const { conversation_id, response, model } = req.body;
    
    if (!conversation_id || !response) {
      return res.status(400).json({ error: 'Konversations-ID och svar krävs' });
    }
    
    // Säkerställ att vi har rätt konversation
    if (memory.currentConversationId !== conversation_id) {
      memory.currentConversationId = conversation_id;
      try {
        const convoResponse = await axios.get(`http://localhost:3000/api/memory/conversation/${conversation_id}`);
        memory.conversationMessages = convoResponse.data.messages || [];
      } catch (e) {
        // Om konversationen inte finns
        memory.conversationMessages = [];
        await memory.startNewConversation('cursor', { 
          conversationId: conversation_id,
          source: 'mcp-response',
          aiModel: model || 'unknown'
        });
      }
    }
    
    // Spara AI-svaret
    await memory.addMessage('assistant', response);
    
    // Extrahera viktig kunskap
    await memory.extractAndSaveKnowledge(response);
    
    res.json({ 
      success: true, 
      conversation_id,
      saved_time: new Date().toISOString(),
      message_count: memory.conversationMessages.length
    });
    
  } catch (error) {
    console.error('MCP Response Error:', error);
    logToFile(error.message, 'error');
    res.status(500).json({ error: 'Ett fel uppstod när svaret skulle sparas' });
  }
});

// Hälsokontrollendpoint för MCP-protokollet
app.get('/mcp/healthcheck', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    service: 'SAM-Screamm_AI_Memory MCP',
    timestamp: new Date().toISOString(),
    memory_server: 'http://localhost:3000',
    supports_streaming: false
  });
});

// Information om tillgängliga verktyg och funktioner
app.get('/mcp/info', (req, res) => {
  res.json({
    name: 'SAM-Screamm_AI_Memory',
    version: '1.0.0',
    description: 'Ett lokalt minnessystem för att förbättra AI-interaktioner i Cursor',
    supports: {
      conversation_memory: true,
      knowledge_base: true,
      context_enrichment: true,
      semantic_search: true
    },
    endpoints: {
      mcp: {
        method: 'POST',
        description: 'Huvudendpoint för att berika prompts med kontext'
      },
      'mcp/response': {
        method: 'POST',
        description: 'Spara AI-svar i minnessystemet'
      },
      'mcp/healthcheck': {
        method: 'GET',
        description: 'Kontrollera serverstatus'
      },
      'mcp/info': {
        method: 'GET',
        description: 'Information om denna MCP-server'
      }
    }
  });
});

// Starta servern
app.listen(PORT, () => {
  console.log(`MCP-server körs på port ${PORT}`);
  console.log('Endpoint: http://localhost:' + PORT + '/mcp');
}); 