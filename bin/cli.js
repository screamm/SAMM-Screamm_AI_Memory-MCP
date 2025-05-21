#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const minimist = require('minimist');

// Parsa argument
const argv = minimist(process.argv.slice(2), {
  string: ['tools', 'memory-server', 'port', 'transport'],
  boolean: ['help', 'version'],
  alias: {
    h: 'help',
    v: 'version',
    t: 'tools',
    p: 'port',
    m: 'memory-server',
    T: 'transport'
  },
  default: {
    tools: 'all',
    port: 3200,
    'memory-server': 'http://localhost:3000',
    transport: 'stdio'
  }
});

// Visa hjälp
if (argv.help) {
  console.log(`
  SAM Cursor Memory - MCP Server
  
  Användning:
    npx -y @sam/cursor-memory [flaggor]
    
  Flaggor:
    -h, --help                    Visa denna hjälptext
    -v, --version                 Visa versionsinformation
    -t, --tools <verktyg>         Vilka minnesverktyg som ska aktiveras (kommaseparerad lista)
                                  Tillgängliga verktyg: conversations,knowledge,search,all
    -p, --port <port>             Port som MCP-servern ska köra på (standard: 3200)
    -m, --memory-server <url>     URL till minnesservern (standard: http://localhost:3000)
    -T, --transport <transport>   Transport att använda: stdio eller http (standard: stdio)
    
  Exempel:
    npx -y @sam/cursor-memory --tools=all
    npx -y @sam/cursor-memory --tools=conversations,knowledge --port=3300
    npx -y @sam/cursor-memory --transport=http
    
  Konfigurationsexempel för Cursor:
    {
      "mcpServers": {
        "sam-memory": {
          "command": "node",
          "args": [
            "./mcp-server.js"
          ]
        }
      }
    }
  `);
  process.exit(0);
}

// Visa version
if (argv.version) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  console.log(`SAM Cursor Memory v${packageJson.version}`);
  process.exit(0);
}

// Konfigurera
const toolsArg = argv.tools;
const port = argv.port;
const memoryServer = argv['memory-server'];
const transport = argv.transport;

// Visa startkonfiguration
console.log(`
SAM Cursor Memory - MCP Server
===============================
Verktyg:        ${toolsArg}
MCP Port:       ${port}
Memory Server:  ${memoryServer}
Transport:      ${transport}
`);

// Starta minnesservern om det behövs
const startMemoryServer = memoryServer === 'http://localhost:3000';

if (startMemoryServer) {
  console.log('Startar minnesserver...');
  
  const memoryProcess = spawn('node', [path.join(__dirname, '../server.js')], {
    stdio: 'inherit'
  });
  
  memoryProcess.on('error', (error) => {
    console.error('Minnesserver fel:', error);
  });
  
  memoryProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Minnesservern avslutades med kod ${code}`);
    }
  });
  
  // Vänta lite så minnesservern hinner starta
  setTimeout(() => {
    startMcpServer();
  }, 1000);
} else {
  startMcpServer();
}

// Funktion för att starta MCP-servern
function startMcpServer() {
  console.log('Startar MCP-server...');
  
  // Sätt miljövariabler för MCP-servern
  const env = {
    ...process.env,
    MCP_PORT: port,
    MCP_MEMORY_SERVER: memoryServer,
    MCP_TOOLS: toolsArg,
    MCP_TRANSPORT: transport
  };
  
  const mcpProcess = spawn('node', [path.join(__dirname, '../mcp-server.js')], {
    env,
    stdio: transport === 'stdio' ? 'pipe' : 'inherit'
  });
  
  if (transport === 'stdio') {
    // När vi använder STDIO, måste vi föra vidare I/O till Cursor-klienten
    process.stdin.pipe(mcpProcess.stdin);
    mcpProcess.stdout.pipe(process.stdout);
    mcpProcess.stderr.pipe(process.stderr);
  }
  
  mcpProcess.on('error', (error) => {
    console.error('MCP-server fel:', error);
  });
  
  mcpProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`MCP-servern avslutades med kod ${code}`);
    }
  });
}

// Hantera avslut
process.on('SIGINT', () => {
  console.log('\nAvbryter servrar...');
  process.exit();
}); 