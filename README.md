# 🧠 Cursor AI Memory

<div align="center">
  
  ![Version](https://img.shields.io/badge/version-1.0.0-blue)
  ![License](https://img.shields.io/badge/license-MIT-green)
  ![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)
  
  **Ett lokalt minnessystem för att förbättra AI-interaktioner i Cursor**
  
  [Installation](#-installation) • 
  [Funktioner](#-funktioner) • 
  [Användning](#-användning) • 
  [API-referens](#-api-referens) • 
  [Bidrag](#-bidrag)
  
</div>

## ✨ Översikt

**Cursor AI Memory** (SAM) är en kraftfull lokal minneslösning som väsentligt förbättrar AI-interaktioner i Cursor IDE. Genom att spara konversationshistorik och kontextuell kunskap lokalt, ger systemet AI:n längre och mer konsekvent minne över tiden.

<p align="center">
  <img src="https://via.placeholder.com/800x400?text=Cursor+AI+Memory+Screenshot" alt="Cursor AI Memory Screenshot" width="800"/>
</p>

### 🌟 Huvudfunktioner

- **Sömlös minnesintegrering** för Claude och Gemini i Cursor
- **Kraftfull TF-IDF-sökning** för att hitta relevant historik
- **Kontextualiserade AI-svar** baserade på din tidigare konversationshistorik
- **Kunskapsbasfunktionalitet** för att lagra viktiga fakta permanent
- **Modern webbgränssnitt** för att utforska och hantera minnen
- **Lokalt och privat** - all data förblir på din dator

## 🚀 Installation

### Förutsättningar

- Node.js (v14 eller senare)
- npm (v6 eller senare)
- En installation av Cursor IDE

### Snabbinstallation

```bash
# Klona repot (eller ladda ned)
git clone https://github.com/din-användare/cursor-ai-memory.git
cd cursor-ai-memory

# Installera beroenden
npm install

# Starta både minnesservern och integrationsproxyn
npm run dev
```

Det räcker! Besök sedan [http://localhost:3000](http://localhost:3000) för att komma åt webbgränssnittet.

## 🛠️ Funktioner

### 1. Minneshantering

Systemet sparar automatiskt all konversationshistorik och kan hitta relevant kontext från tidigare samtal när du ställer liknande frågor.

### 2. Kontextberikning

AI-svaren förbättras genom att lägga till relevant kontext från tidigare konversationer, vilket gör att AI:n kan:
- **Komma ihåg** tidigare diskuterade koncept
- **Bygga vidare** på tidigare svar
- **Konsekvent följa upp** över längre tidsperioder

### 3. Kunskapsbas

Lagra viktig information permanent:
- **Manuell lagring** av viktig kunskap
- **Automatisk extraktion** av viktiga fakta från AI-svar
- **Taggning och sökning** av kunskapsenheter

### 4. Dynamisk sökning

Sök genom all konversationshistorik och kunskapsbas för att hitta relevant information om ditt nuvarande projekt.

## 📊 Systemarkitektur

Systemet består av tre huvudkomponenter:

1. **MCP Server (Memory Control Process)** - Hjärtpunkten i systemet som hanterar lagring och hämtning av minnen
2. **Cursor Integration** - Integrationslagret som kopplar Cursor till minnessystemet
3. **Webbgränssnitt** - Ger en visuell representation av lagrade minnen
4. **Systemövervakning** - Ett modernt övervakningsgränssnitt för att kontrollera båda servrarnas status

```
┌───────────────┐      ┌────────────────────┐      ┌─────────────────┐
│               │      │                    │      │                 │
│  Cursor IDE   │<─────│ Integrationsproxy  │<─────│   MCP Server    │
│               │      │ (cursor-integration)│      │ (minneslagring) │
└───────────────┘      └────────────────────┘      └─────────────────┘
                                                          │
                                                          │
                                                          v
                                                   ┌─────────────────┐
                                                   │                 │
                                                   │  Webbgränssnitt │
                                                   │                 │
                                                   └─────────────────┘
```

## 🖥️ Användning

### Webbgränssnittet

När servern är igång, besök [http://localhost:3000](http://localhost:3000) för att utforska:

- **Konversationsfliken** - Bläddra genom din AI-chatthistorik
- **Kunskapsfliken** - Hantera din sparade kunskap
- **Sökfliken** - Hitta specifik information
- **Inställningsfliken** - Konfigurera systemet

### Systemövervakning

För att övervaka systemets hälsa, besök [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

Här kan du:
- Se status för minnesservern och integrationsproxyn
- Övervaka minneskonsumtion och CPU-användning
- Se detaljerad statistik över konversationer och kunskapsdata
- Hantera servrarna (starta om etc.)

### Integration med Cursor

#### Metod 1: Proxylösning (rekommenderad)

För att integrera med Cursor, använd vår proxylösning:

1. Se till att både minnesservern och proxyn körs:
   ```bash
   npm run dev
   ```

2. Konfigurera Cursor att använda din lokala proxy för AI-anrop:
   - För Claude: `http://localhost:3100/proxy/claude`
   - För Gemini: `http://localhost:3100/proxy/gemini`

#### Metod 2: Direkt API-integration

Använd minneskomponenten direkt i dina egna skript:

```javascript
const CursorMemoryExtension = require('./cursor-memory-extension');
const memory = new CursorMemoryExtension();

// Starta en ny konversation
await memory.startNewConversation('claude');

// Använd minnesförbättrad interaktion
const response = await memory.fullMemoryAugmentedInteraction(
  "Min fråga",
  (prompt) => callYourAIFunction(prompt)
);
```

## 📚 API-referens

### Minnesserver (port 3000)

| Metod | Endpoint | Beskrivning |
|-------|----------|-------------|
| GET | `/api/memory/conversations` | Hämta alla konversationer |
| POST | `/api/memory/conversation` | Skapa eller uppdatera en konversation |
| GET | `/api/memory/conversation/:id` | Hämta en specifik konversation |
| DELETE | `/api/memory/conversation/:id` | Radera en konversation |
| GET | `/api/memory/knowledge` | Hämta all kunskap |
| POST | `/api/memory/knowledge` | Lägg till eller uppdatera kunskap |
| GET | `/api/memory/knowledge/:key` | Hämta specifik kunskap |
| DELETE | `/api/memory/knowledge/:key` | Radera kunskap |
| GET | `/api/memory/search` | Sök i minnen |
| POST | `/api/memory/generate-context` | Generera kontext för prompt |

### Integrationsproxy (port 3100)

| Metod | Endpoint | Beskrivning |
|-------|----------|-------------|
| POST | `/proxy/claude` | Anropa Claude AI med minnesförbättring |
| POST | `/proxy/gemini` | Anropa Gemini AI med minnesförbättring |

## 🔒 Säkerhet

Detta projekt är avsett för **lokal användning**. Minnesservern lagrar all konversations- och kunskapsdata lokalt på din maskin. 

⚠️ **Notera:** Systemet har inte implementerat avancerad autentisering eller kryptering, så använd inte i produktionsmiljöer utan lämpliga säkerhetskontroller.

## 🛣️ Roadmap

- [ ] **Vektorbaserad semantisk sökning** för bättre relevansfiltrering
- [ ] **Browser-extension** för sömlös Cursor-integration
- [ ] **Automatisk kunskapsextraktion** från konversationer
- [ ] **Databasintegrering** för hantering av stora datamängder
- [ ] **Avancerad kontexthantering** med historisk-kontext-modeller
- [ ] **Säkerhetsförbättringar** med kryptering och autentisering

## 👥 Bidrag

Bidrag välkomnas! Om du vill bidra:

1. Forka repot
2. Skapa din feature branch (`git checkout -b feature/amazing-feature`)
3. Commita dina ändringar (`git commit -m 'Add amazing feature'`)
4. Pusha till branchen (`git push origin feature/amazing-feature`)
5. Öppna en Pull Request

## 📄 Licens

Detta projekt är licensierat under MIT-licensen - se [LICENSE](LICENSE) för detaljer.

## 📬 Kontakt

David - [Din E-post](mailto:din-email@example.com)

Projektlänk: [https://github.com/din-användare/cursor-ai-memory](https://github.com/din-användare/cursor-ai-memory)

---

<div align="center">
  <sub>Byggd med ❤️ för bättre AI-interaktion i Cursor</sub>
</div> 