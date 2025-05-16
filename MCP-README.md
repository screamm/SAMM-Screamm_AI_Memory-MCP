# SAM Cursor Memory - MCP Integration

Detta dokument beskriver hur du använder SAM Cursor Memory med Model Context Protocol (MCP) för att integrera med Cursor och andra AI-verktyg.

## Vad är MCP?

Model Context Protocol (MCP) är ett standardprotokoll för att berika AI-prompts med kontext från externa system. MCP används av bland annat Anthropic Claude för att utöka AI-modellens kontext med information från olika verktyg och minneshanterare.

## Använda MCP-servern

### Starta MCP-servern

Du kan starta vår MCP-server på flera sätt:

#### 1. Direkt via Node.js:

```bash
# Starta endast MCP-servern (kräver att minnesservern körs på port 3000)
node mcp-server.js

# Starta med anpassad port
MCP_PORT=3300 node mcp-server.js
```

#### 2. Via npm-skript:

```bash
# Starta MCP-servern
npm run start:mcp

# Starta både minnesservern och MCP-servern samtidigt
npm run dev:mcp
```

#### 3. Via CLI-verktyget (lokalt):

```bash
# Visa hjälp
node bin/cli.js --help

# Starta med alla funktioner
node bin/cli.js --tools=all

# Starta med specifika funktioner
node bin/cli.js --tools=conversations,knowledge --port=3300
```

#### 4. Via NPX (om publicerad):

```bash
# Starta med alla funktioner
npx -y @sam/cursor-memory --tools=all

# Starta med specifika funktioner
npx -y @sam/cursor-memory --tools=conversations,knowledge --port=3300
```

### API-endpoints

MCP-servern tillhandahåller följande endpoints:

- `POST /mcp` - Huvudendpoint för att berika prompts med kontext
- `POST /mcp/response` - Spara AI-svar i minnessystemet
- `GET /mcp/healthcheck` - Kontrollera serverstatus
- `GET /mcp/info` - Information om denna MCP-server

## Integration med Cursor IDE

För att integrera med Cursor IDE, måste du konfigurera den att använda vår MCP-server.

### Cursor-konfiguration

Cursor använder en konfigurationsfil för MCP-servrar. Denna kan normalt hittas i:

- Windows: `%APPDATA%\Cursor\Config\cursor_config.json`
- macOS: `~/Library/Application Support/Cursor/Config/cursor_config.json`
- Linux: `~/.config/Cursor/Config/cursor_config.json`

Lägg till följande i konfigurationsfilen:

```json
{
  "mcpServers": {
    "sam-memory": {
      "command": "node",
      "args": [
        "SÖKVÄG/TILL/mcp-server.js"
      ],
      "url": "http://localhost:3200/mcp"
    }
  }
}
```

Ersätt `SÖKVÄG/TILL` med den faktiska sökvägen till ditt projekt.

Om du har installerat paketet globalt eller via NPX, kan du använda:

```json
{
  "mcpServers": {
    "sam-memory": {
      "command": "npx",
      "args": [
        "-y",
        "@sam/cursor-memory",
        "--tools=all"
      ],
      "url": "http://localhost:3200/mcp"
    }
  }
}
```

### Använda MCP-förbättring i Cursor

Efter konfiguration kommer Cursor att automatiskt använda din MCP-server för att förbättra prompten med kontext från ditt minnessystem när du interagerar med AI-assistenten.

## Tekniska detaljer

### MCP-svarformat

MCP-servern svarar med följande JSON-format:

```json
{
  "id": "sam-mem-12345678",
  "object": "memory_enhancement",
  "created": 1647123456,
  "model": "sam-cursor-memory-v1",
  "enhanced_prompt": "Förbättrad prompt med kontext...",
  "original_prompt": "Ursprunglig prompt...",
  "conversation_id": "mcp-cursor-12345678",
  "system_info": {
    "memory_provider": "SAM-Screamm_AI_Memory",
    "version": "1.0.0",
    "context_used": true,
    "context_tokens_approximate": 250,
    "memory_stats": {
      "context_percentage": 75,
      "conversation_messages": 10
    }
  }
}
```

### Förbättringsprocess

När en prompt skickas till MCP-servern:

1. Servern söker efter relevant kontext från tidigare konversationer och kunskapsbasen
2. Kontexten läggs till i början av prompten i ett standardiserat format
3. Användarens fråga läggs till i minnessystemet
4. Den förbättrade prompten returneras tillsammans med metadata

När ett svar från AI-modellen tas emot, skickas det till `/mcp/response` för att spara i minnessystemet och eventuellt extrahera viktig kunskap.

## Felsökning

### Vanliga problem

- **MCP-servern startar inte**: Kontrollera att minnesservern körs på port 3000 eller specificera en annan URL med `--memory-server`.
- **Cursor hittar inte MCP-servern**: Kontrollera att URL:en i konfigurationen är korrekt.
- **Inget minne används**: Kontrollera att du har tidigare konversationer eller kunskap i systemet.

### Loggning

MCP-servern loggar all aktivitet till `logs/mcp.log`. Om du har problem, kontrollera denna fil för mer information.

## Utveckling och utökning

För utvecklare som vill utöka funktionaliteten:

- `mcp-server.js` innehåller huvudlogiken för MCP-servern
- `bin/cli.js` innehåller CLI-verktyget för att starta servern
- MCP-protokollet kan utökas med mer metadata och funktioner

För att bidra, se instruktionerna i huvudprojektets README. 