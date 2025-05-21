# SAM - Screamm AI Memory

Ett minnesystem för Cursor IDE som sparar AI-chattarna till en minnesserver och använder dem för att tillhandahålla bättre kontext via Model Context Protocol (MCP).

## Funktioner

- Sparar AI-konversationer till lokal minnesserver
- Använder tidigare konversationer för att förbättra kontexten i nya konversationer
- Integrerar med Cursor via Model Context Protocol (MCP)
- Tillhandahåller verktyg för att:
  - Hämta relevanta tidigare konversationer baserat på sökfråga
  - Spara nya konversationer
  - Visa minnesstatistik

## Installation

1. Klona detta repository
2. Installera beroenden med npm:

```
npm install
```

## Användning

Starta hela systemet med ett enda kommando:

```
node start.js
```

Detta startar:
1. Minnesservern (sparar konversationer)
2. MCP-servern (kommunicerar med Cursor)

För att ange en annan port för minnesservern:

```
node start.js --port=8080
```

## Cursor-integration

För att integrera med Cursor IDE, skapa filen `cursor-mcp-config.json` i din AppData-mapp för Cursor:

Windows: `%AppData%\Cursor\cursor-mcp-config.json`
Mac: `~/Library/Application Support/Cursor/cursor-mcp-config.json`
Linux: `~/.config/Cursor/cursor-mcp-config.json`

Med följande innehåll:

```json
{
  "mcpServers": {
    "sam-memory": {
      "command": "node",
      "args": ["SÖKVÄG_TILL_DIN_KATALOG/mcp-server.js"],
      "env": {
        "MCP_MEMORY_SERVER": "http://localhost:3000",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

Ersätt `SÖKVÄG_TILL_DIN_KATALOG` med den absoluta sökvägen till din installation av SAM.

## Tillgängliga MCP-verktyg

När servern är ansluten till Cursor, blir följande verktyg tillgängliga:

- `get-relevant-conversations` - Hämtar relevanta tidigare konversationer baserat på en sökfråga
- `save-conversation` - Sparar en ny konversation till minnesservern
- `get-conversation` - Hämtar en specifik konversation med ID

## Teknisk information

Projektet består av två huvudkomponenter:

1. **Minnesserver** - En Express.js-server som hanterar lagring och hämtning av AI-konversationer
2. **MCP-server** - En MCP-server som integrerar med Cursor IDE och kommunicerar med minnesservern

Systemet använder STDIO-transport för MCP-protokollet för bästa möjliga integration med Cursor.

## Utveckling och felsökning

För att övervaka status och loggmeddelanden, kolla mappen `logs/` som innehåller loggfiler för alla systemkomponenter.

Webbgränssnittet för minnesservern finns på:
- Dashboard: http://localhost:3000/dashboard
- API-status: http://localhost:3000/api/status 