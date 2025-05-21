/**
 * SAM MCP Memory Start Script
 * 
 * Detta skript startar både minnesservern och MCP-servern för att 
 * använda tidigare AI-konversationer som kontext i Cursor.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

// Inställningar
const DEFAULT_MEMORY_PORT = 3000;
const LOG_DIR = path.join(__dirname, 'logs');
const IS_WINDOWS = os.platform() === 'win32';

// Skapa loggmapp om den inte finns
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirpSync(LOG_DIR);
}

function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}`;
  console.log(logMessage);
  
  try {
    fs.appendFileSync(path.join(LOG_DIR, 'start.log'), logMessage + '\n');
  } catch (error) {
    console.error(`Kunde inte skriva till loggfil: ${error.message}`);
  }
}

function createLogWriteStream(filename) {
  return fs.createWriteStream(path.join(LOG_DIR, filename), { flags: 'a' });
}

// Starta en process och hantera dess utdata
function startProcess(command, args, name, logFile) {
  log(`Startar ${name}...`);
  
  const logStream = createLogWriteStream(logFile);
  
  // Windows använder cmd.exe för kommandon
  const actualCommand = IS_WINDOWS && command === 'node' ? process.execPath : command;
  
  const proc = spawn(actualCommand, args, {
    cwd: __dirname,
    env: {
      ...process.env,
      MCP_MEMORY_SERVER: `http://localhost:${DEFAULT_MEMORY_PORT}`,
      MCP_TRANSPORT: 'stdio'
    }
  });
  
  // Hantera stdout och stderr
  proc.stdout.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      logStream.write(`[${new Date().toISOString()}] [STDOUT] ${message}\n`);
    }
  });
  
  proc.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      logStream.write(`[${new Date().toISOString()}] [STDERR] ${message}\n`);
      // Om det är viktigt, visa i huvudloggen också
      if (message.includes('ERROR') || message.includes('FATAL')) {
        log(`${name} fel: ${message}`, 'ERROR');
      }
    }
  });
  
  // Hantera processavslut
  proc.on('close', (code) => {
    const exitMessage = `${name} avslutades med kod ${code}`;
    if (code !== 0) {
      log(exitMessage, 'ERROR');
    } else {
      log(exitMessage);
    }
    logStream.end();
  });
  
  proc.on('error', (err) => {
    log(`${name} kunde inte startas: ${err.message}`, 'ERROR');
    logStream.end();
  });
  
  return proc;
}

// Funktion för att hämta port från kommandoradsargument
function getPort() {
  const args = process.argv.slice(2);
  const portArg = args.find(arg => arg.startsWith('--port='));
  if (portArg) {
    const port = parseInt(portArg.split('=')[1], 10);
    if (!isNaN(port) && port > 0) {
      return port;
    }
  }
  return DEFAULT_MEMORY_PORT;
}

// Huvudfunktion
function main() {
  log('Startar SAM MCP Memory system...');
  
  // Hämta port från kommandoradsargument
  const port = getPort();
  log(`Minnesserver kommer starta på port ${port}`);
  
  // Starta minnesservern
  const memoryServer = startProcess(
    'node',
    ['server.js', `--port=${port}`],
    'Minnesserver',
    'memory-server.log'
  );
  
  // Vänta en kort stund för att låta minnesservern starta
  setTimeout(() => {
    // Starta MCP-servern
    const mcpServer = startProcess(
      'node',
      ['mcp-server.js'],
      'MCP-server',
      'mcp-server.log'
    );
    
    // Hantera processavslut för att stänga båda servrarna
    process.on('SIGINT', () => {
      log('Avslutningssignal mottagen, stänger servrar...');
      mcpServer.kill();
      memoryServer.kill();
    });
    
    process.on('SIGTERM', () => {
      log('Termineringssignal mottagen, stänger servrar...');
      mcpServer.kill();
      memoryServer.kill();
    });
    
    log('Alla servrar startade! Tryck Ctrl+C för att avsluta.');
  }, 2000);
}

// Starta direkt om detta är huvudmodulen
if (require.main === module) {
  main();
}

module.exports = { main }; 