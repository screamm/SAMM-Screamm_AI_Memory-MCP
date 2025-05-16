/**
 * Test-exempel för Cursor AI Memory-systemet
 */

const axios = require('axios');
const CursorMemoryExtension = require('./cursor-memory-extension');

const memory = new CursorMemoryExtension('http://localhost:3000');

// Simulerad AI-funktion (eftersom vi inte har direkt tillgång till Cursor API)
const simulateAI = async (prompt) => {
  console.log(`\n### AI-anropet skulle använda denna prompt: ###\n${prompt}\n`);
  
  // Simulerar ett enkelt AI-svar
  return `Detta är ett simulerat svar från AI baserat på din fråga: "${prompt.split('\n').pop()}"`;
};

// Exempel på hur man använder minnessystemet
async function runTest() {
  try {
    console.log('CURSOR AI MEMORY - TESTSESSION');
    console.log('===============================\n');
    
    // 1. Skapa en ny konversation
    console.log('1. Startar en ny konversation...');
    await memory.startNewConversation('claude', { 
      testSession: true, 
      topic: 'JavaScript programmering'
    });
    
    // 2. Första interaktionen - lagra viktig kunskap
    console.log('\n2. Första interaktionen med AI...');
    const firstQuestion = 'Vad är några bra metoder för att hantera asynkron kod i JavaScript?';
    const firstResponse = await memory.fullMemoryAugmentedInteraction(firstQuestion, simulateAI);
    
    console.log(`\nAI-svar: ${firstResponse}`);
    
    // 3. Spara explicit kunskap
    console.log('\n3. Sparar explicit kunskap...');
    await memory.saveKnowledge(
      'javascript-async-patterns',
      'Det finns flera sätt att hantera asynkronitet i JavaScript:\n' +
      '1. Callbacks - Traditionell metod men kan leda till callback-helvete\n' +
      '2. Promises - Bättre hantering med .then() och .catch()\n' +
      '3. Async/await - Modernaste sättet, gör koden mer läsbar\n' +
      '4. Observables (RxJS) - För hantering av event-strömmar',
      { 
        topic: 'JavaScript',
        tags: ['async', 'promises', 'callbacks']
      }
    );
    
    // 4. Andra interaktionen - med minne
    console.log('\n4. Andra interaktionen med AI - med minneskontext...');
    const secondQuestion = 'Kan du visa ett exempel på async/await i JavaScript?';
    const secondResponse = await memory.fullMemoryAugmentedInteraction(secondQuestion, simulateAI);
    
    console.log(`\nAI-svar: ${secondResponse}`);
    
    // 5. Visa sparade konversationer via API
    console.log('\n5. Hämtar sparade konversationer från API...');
    const conversationsResponse = await axios.get('http://localhost:3000/api/memory/conversations');
    console.log(`Hittade ${conversationsResponse.data.total} konversationer`);
    
    // 6. Visa sparad kunskap via API
    console.log('\n6. Hämtar sparad kunskap från API...');
    const knowledgeResponse = await axios.get('http://localhost:3000/api/memory/knowledge');
    console.log(`Sparad kunskap: ${knowledgeResponse.data.map(k => k.key).join(', ')}`);
    
    // 7. Visa hur kontextgenerering fungerar
    console.log('\n7. Testar kontextgenerering för en relaterad fråga...');
    const contextResponse = await axios.post('http://localhost:3000/api/memory/generate-context', {
      query: 'Hur fungerar promises i JavaScript?'
    });
    
    console.log('\nGenererad kontext för en relaterad fråga:');
    console.log(contextResponse.data.contextPrompt);
    
    console.log('\nTest slutfört! Besök http://localhost:3000 för att se allt lagrat minne.');
    
  } catch (error) {
    console.error('Fel under testkörning:', error.message);
    if (error.response) {
      console.error('API-svar:', error.response.data);
    }
  }
}

// Se till att servern körs innan detta test körs
console.log('Se till att server.js körs innan detta test!\n');
console.log('Väntar 2 sekunder innan testet startar...\n');

setTimeout(() => {
  runTest();
}, 2000); 