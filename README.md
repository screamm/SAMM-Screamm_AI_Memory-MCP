# 🧠 Cursor AI Memory

<div align="center">
  
  ![Version](https://img.shields.io/badge/version-1.0.0-blue)
  ![License](https://img.shields.io/badge/license-MIT-green)
  ![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)
  
  **A local memory system to enhance AI interactions in Cursor**
  
  [Installation](#-installation) • 
  [Features](#-features) • 
  [Usage](#-usage) • 
  [API Reference](#-api-reference) • 
  [Contributions](#-contributions)
  
</div>

## ✨ Overview

**Cursor AI Memory** (SAM) is a powerful local memory solution that significantly enhances AI interactions in the Cursor IDE. By saving conversation history and contextual knowledge locally, the system provides AI with longer and more consistent memory over time.

<p align="center">
  <img src="https://via.placeholder.com/800x400?text=Cursor+AI+Memory+Screenshot" alt="Cursor AI Memory Screenshot" width="800"/>
</p>

### 🌟 Key Features

- **Seamless memory integration** for Claude and Gemini in Cursor
- **Powerful TF-IDF search** to find relevant history
- **Contextualized AI responses** based on your previous conversation history
- **Knowledge base functionality** to permanently store important facts
- **Modern web interface** to explore and manage memories
- **Local and private** - all data remains on your computer

## 🚀 Installation

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)
- A Cursor IDE installation

### Quick Installation

```bash
# Clone the repo (or download)
git clone https://github.com/your-username/cursor-ai-memory.git
cd cursor-ai-memory

# Install dependencies
npm install

# Start both the memory server and integration proxy
npm run dev
```

That's it! Then visit [http://localhost:3000](http://localhost:3000) to access the web interface.

## 🛠️ Features

### 1. Memory Management

The system automatically saves all conversation history and can find relevant context from previous conversations when you ask similar questions.

### 2. Context Enrichment

AI responses are improved by adding relevant context from previous conversations, allowing the AI to:
- **Remember** previously discussed concepts
- **Build upon** previous answers
- **Consistently follow up** over longer time periods

### 3. Knowledge Base

Store important information permanently:
- **Manual storage** of important knowledge
- **Automatic extraction** of key facts from AI responses
- **Tagging and searching** of knowledge items

### 4. Dynamic Search

Search through all conversation history and knowledge base to find relevant information about your current project.

## 📊 System Architecture

The system consists of three main components:

1. **MCP Server (Memory Control Process)** - The heart of the system that handles the storage and retrieval of memories
2. **Cursor Integration** - The integration layer that connects Cursor to the memory system
3. **Web Interface** - Provides a visual representation of stored memories
4. **System Monitoring** - A modern monitoring interface to check the status of both servers

```
┌───────────────┐      ┌────────────────────┐      ┌─────────────────┐
│               │      │                    │      │                 │
│  Cursor IDE   │<─────│ Integration Proxy  │<─────│   MCP Server    │
│               │      │ (cursor-integration)│      │ (memory storage)│
└───────────────┘      └────────────────────┘      └─────────────────┘
                                                          │
                                                          │
                                                          v
                                                   ┌─────────────────┐
                                                   │                 │
                                                   │  Web Interface  │
                                                   │                 │
                                                   └─────────────────┘
```

## 🖥️ Usage

### Web Interface

When the server is running, visit [http://localhost:3000](http://localhost:3000) to explore:

- **Conversations Tab** - Browse through your AI chat history
- **Knowledge Tab** - Manage your saved knowledge
- **Search Tab** - Find specific information
- **Settings Tab** - Configure the system

### System Monitoring

To monitor system health, visit [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

Here you can:
- See the status of the memory server and integration proxy
- Monitor memory consumption and CPU usage
- View detailed statistics on conversations and knowledge data
- Manage the servers (restart etc.)

### Integration with Cursor

#### Method 1: Proxy Solution (recommended)

To integrate with Cursor, use our proxy solution:

1. Make sure both the memory server and proxy are running:
   ```bash
   npm run dev
   ```

2. Configure Cursor to use your local proxy for AI calls:
   - For Claude: `http://localhost:3100/proxy/claude`
   - For Gemini: `http://localhost:3100/proxy/gemini`

#### Method 2: Direct API Integration

Use the memory component directly in your own scripts:

```javascript
const CursorMemoryExtension = require('./cursor-memory-extension');
const memory = new CursorMemoryExtension();

// Start a new conversation
await memory.startNewConversation('claude');

// Use memory-enhanced interaction
const response = await memory.fullMemoryAugmentedInteraction(
  "My question",
  (prompt) => callYourAIFunction(prompt)
);
```

## 📚 API Reference

### Memory Server (port 3000)

| Method | Endpoint | Description |
|-------|----------|-------------|
| GET | `/api/memory/conversations` | Retrieve all conversations |
| POST | `/api/memory/conversation` | Create or update a conversation |
| GET | `/api/memory/conversation/:id` | Retrieve a specific conversation |
| DELETE | `/api/memory/conversation/:id` | Delete a conversation |
| GET | `/api/memory/knowledge` | Retrieve all knowledge |
| POST | `/api/memory/knowledge` | Add or update knowledge |
| GET | `/api/memory/knowledge/:key` | Retrieve specific knowledge |
| DELETE | `/api/memory/knowledge/:key` | Delete knowledge |
| GET | `/api/memory/search` | Search memories |
| POST | `/api/memory/generate-context` | Generate context for prompt |

### Integration Proxy (port 3100)

| Method | Endpoint | Description |
|-------|----------|-------------|
| POST | `/proxy/claude` | Call Claude AI with memory enhancement |
| POST | `/proxy/gemini` | Call Gemini AI with memory enhancement |

## 🔌 MCP Integration with Cursor IDE

### What is MCP?

Model Context Protocol (MCP) is a standard protocol used by Cursor and other AI tools to enrich prompts with external context. This system implements MCP for seamless memory integration.

### Starting All Services

To start all services (memory server, integration proxy, and MCP server):

```bash
npm run dev:all
```

### Configuring Cursor for MCP Integration

Add this configuration to Cursor's settings for MCP integration. This JSON can be added to your Cursor configuration file:

```json
{
  "mcpServers": {
    "sam-memory": {
      "command": "node",
      "args": [
        "PATH/TO/YOUR/PROJECT/mcp-server.js"
      ],
      "url": "http://localhost:3200/mcp"
    }
  }
}
```

Replace `PATH/TO/YOUR/PROJECT` with the actual path to your project.

### Cursor Configuration File Locations

- **Windows**: `%APPDATA%\Cursor\Config\cursor_config.json`
- **macOS**: `~/Library/Application Support/Cursor/Config/cursor_config.json`
- **Linux**: `~/.config/Cursor/Config/cursor_config.json`

### Troubleshooting MCP Connection

If you experience issues with the MCP connection:

1. Ensure all servers are running with `npm run dev:all`
2. Check the MCP server is working by visiting `http://localhost:3200/mcp/healthcheck`
3. Verify your cursor_config.json has the correct path to mcp-server.js
4. Restart Cursor IDE to apply configuration changes

For more details on MCP integration, see the MCP-README.md file in the project.

## 🔒 Security

This project is intended for **local use**. The memory server stores all conversation and knowledge data locally on your machine.

⚠️ **Note:** The system has not implemented advanced authentication or encryption, so do not use in production environments without appropriate security controls.

## 🛣️ Roadmap

- [ ] **Vector-based semantic search** for better relevance filtering
- [ ] **Browser extension** for seamless Cursor integration
- [ ] **Automatic knowledge extraction** from conversations
- [ ] **Database integration** for handling large amounts of data
- [ ] **Advanced context handling** with historical-context models
- [ ] **Security improvements** with encryption and authentication

## 👥 Contributions

Contributions are welcome! If you want to contribute:

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## 💝 Support the Developer

If you find this project helpful, consider buying the developer a coffee:

<a href="https://www.buymeacoffee.com/screamm" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50px">
</a>

## 📬 Contact

David - [Your Email](mailto:contact@davidlindestrandcuenca.se)

Project Link: [https://github.com/screamm/cursor-ai-memory](https://github.com/screamm/cursor-ai-memory)

---

<div align="center">
  <sub>Built with ❤️ for better AI interaction in Cursor</sub>
</div> 