const axios = require('axios');

class CursorMemoryExtension {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.currentConversationId = null;
    this.conversationMessages = [];
  }

  /**
   * Initierar en ny AI-konversation
   * @param {string} aiType - 'claude' eller 'gemini'
   * @param {object} metadata - Extra information om konversationen
   */
  async startNewConversation(aiType, metadata = {}) {
    const id = `${aiType}-${Date.now()}`;
    this.currentConversationId = id;
    this.conversationMessages = [];
    
    await axios.post(`${this.baseUrl}/api/memory/conversation`, {
      id,
      messages: [],
      metadata: {
        aiType,
        startTime: new Date().toISOString(),
        ...metadata
      }
    });
    
    console.log(`Ny konversation startad: ${id}`);
    return id;
  }

  /**
   * Lägger till ett meddelande i den aktuella konversationen
   * @param {string} role - 'user' eller 'assistant'
   * @param {string} content - Meddelandeinnehållet
   */
  async addMessage(role, content) {
    if (!this.currentConversationId) {
      throw new Error('Ingen aktiv konversation');
    }
    
    const message = { role, content, timestamp: new Date().toISOString() };
    this.conversationMessages.push(message);
    
    await axios.post(`${this.baseUrl}/api/memory/conversation`, {
      id: this.currentConversationId,
      messages: this.conversationMessages
    });
    
    return message;
  }

  /**
   * Hämtar relevant kontext från tidigare konversationer baserat på en fråga
   * @param {string} query - Användarens fråga eller ämne
   * @param {number} maxItems - Maximalt antal kontextelement att hämta
   */
  async getRelevantContext(query, maxItems = 5) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/memory/generate-context`, {
        query,
        maxItems
      });
      
      return response.data.contextPrompt;
    } catch (error) {
      console.error('Fel vid hämtning av kontext:', error);
      return '';
    }
  }

  /**
   * Sparar en viktig faktabit eller kunskap för framtida användning
   * @param {string} key - Nyckel för kunskapen
   * @param {any} data - Data att spara
   * @param {object} metadata - Extra metadata
   */
  async saveKnowledge(key, data, metadata = {}) {
    await axios.post(`${this.baseUrl}/api/memory/knowledge`, {
      key,
      data,
      metadata: {
        source: this.currentConversationId,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    });
    
    console.log(`Kunskap sparad: ${key}`);
  }

  /**
   * Ökar AI-prompts genom att lägga till relevant kontext från tidigare interaktioner
   * @param {string} originalPrompt - Den ursprungliga användarfrågan
   */
  async enhancePrompt(originalPrompt) {
    const context = await this.getRelevantContext(originalPrompt);
    
    if (!context || context.trim() === '') {
      return originalPrompt;
    }
    
    return `
${context}

Användarens aktuella fråga: ${originalPrompt}

Notera att ovanstående innehåller relevant kontext från tidigare konversationer. Använd den för att ge ett mer informerat svar, men fokusera på att svara på den aktuella frågan.
`;
  }

  /**
   * Extraherar och sparar viktig kunskap från assistentens svar
   * @param {string} assistantResponse - Assistentens svar
   */
  async extractAndSaveKnowledge(assistantResponse) {
    // Här skulle man kunna implementera mer avancerad extrahering
    // För nu sparar vi bara långa, informativa svar som potentiellt viktiga
    if (assistantResponse.length > 500) {
      const key = `auto-extracted-${Date.now()}`;
      const shortAnswer = assistantResponse.substring(0, 100).replace(/\s+/g, ' ').trim();
      
      await this.saveKnowledge(key, assistantResponse, {
        autoExtracted: true,
        summary: shortAnswer + '...'
      });
    }
  }
  
  /**
   * Implementerar full prompt-förbättring och minneshantering för en AI-interaktion
   * @param {string} originalPrompt - Ursprunglig användarfråga
   * @param {function} aiCallback - Funktion som anropar AI:n med en prompt och returnerar svaret
   */
  async fullMemoryAugmentedInteraction(originalPrompt, aiCallback) {
    try {
      // Förbättra prompten med tidigare kontext
      const enhancedPrompt = await this.enhancePrompt(originalPrompt);
      
      // Lägg till användarens meddelande i konversationen
      await this.addMessage('user', originalPrompt);
      
      console.log('Anropar AI med förbättrad prompt...');
      
      // Anropa AI-funktionen med den förbättrade prompten
      const assistantResponse = await aiCallback(enhancedPrompt);
      
      // Spara assistentens svar i konversationen
      await this.addMessage('assistant', assistantResponse);
      
      // Extrahera eventuell viktig kunskap från svaret
      await this.extractAndSaveKnowledge(assistantResponse);
      
      return assistantResponse;
    } catch (error) {
      console.error('Fel vid memory-augmented interaction:', error);
      // Vid fel, returnera originalsvaret från AI:n utan minnesförbättring
      return aiCallback(originalPrompt);
    }
  }
}

module.exports = CursorMemoryExtension; 