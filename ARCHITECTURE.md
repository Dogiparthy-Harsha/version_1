# AI Shopping Assistant - MCP Architecture

## 🏗️ System Architecture

This project uses **Model Context Protocol (MCP)** for a microservices-based multi-agent architecture.

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Browser)                      │
│                       index.html + JS                        │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP POST /chat
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Main API (FastAPI)                         │
│                      api_mcp.py                              │
│                                                              │
│  - Handles user conversation                                │
│  - Generates search queries                                 │
│  - Coordinates MCP agents                                   │
└────────────────────────┬────────────────────────────────────┘
                         │ MCP Protocol
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   MCP Client Manager                         │
│                     mcp_client.py                            │
│                                                              │
│  - Manages connections to MCP servers                       │
│  - Routes tool calls to appropriate servers                 │
└────────┬───────────────┬───────────────┬────────────────────┘
         │               │               │
         ▼               ▼               ▼
┌────────────────┐ ┌────────────┐ ┌──────────────┐
│ Research Agent │ │ eBay Agent │ │ Amazon Agent │
│  MCP Server    │ │ MCP Server │ │  MCP Server  │
└────────┬───────┘ └─────┬──────┘ └──────┬───────┘
         │               │               │
         ▼               ▼               ▼
┌────────────────┐ ┌────────────┐ ┌──────────────┐
│ ResearchAgent  │ │ eBaySearch │ │ Rainforest   │
│   (Core)       │ │  (Core)    │ │   (Core)     │
└────────┬───────┘ └─────┬──────┘ └──────┬───────┘
         │               │               │
         ▼               ▼               ▼
    Serper API      eBay API      Rainforest API
```

## 🎯 Agent Responsibilities

### 1. **Main Conversational Agent** (`api_mcp.py`)
- **Model**: `google/gemini-2.5-flash-lite`
- **Purpose**: User interaction and query generation
- **Tasks**:
  - Understand user intent
  - Ask clarifying questions (model, color, budget, etc.)
  - Generate final search query
  - Coordinate with MCP agents
  - Format and return results

### 2. **Research Agent** (MCP Server)
- **Location**: `mcp_servers/research_server.py`
- **Core Logic**: `agents/research_agent.py`
- **Model**: `google/gemini-2.5-flash-lite`
- **Purpose**: Product verification via web search
- **Tools**:
  - `verify_product` - Checks if product exists and is available
- **Tasks**:
  - Search web for product info (Serper API)
  - Verify product exists and is currently available
  - Check release dates
  - Return: exists, info, confidence, release_status

### 3. **eBay Search Agent** (MCP Server)
- **Location**: `mcp_servers/ebay_server.py`
- **Core Logic**: `agents/search_agents.py` (eBaySearch class)
- **Purpose**: Search eBay for products
- **Tools**:
  - `search_ebay` - Search eBay Browse API
- **Tasks**:
  - Authenticate with eBay API
  - Search for products
  - Return: title, price, condition, URL, image

### 4. **Amazon Search Agent** (MCP Server)
- **Location**: `mcp_servers/amazon_server.py`
- **Core Logic**: `agents/search_agents.py` (RainforestSearch class)
- **Purpose**: Search Amazon for products
- **Tools**:
  - `search_amazon` - Search via Rainforest API
- **Tasks**:
  - Query Rainforest API
  - Search for products
  - Return: title, price, rating, URL, image

## 🔄 Request Flow

### Example: User searches for "iPhone 16"

```
1. User: "I want an iPhone"
   ↓
2. Main Agent: "What storage capacity? New or used?"
   ↓
3. User: "256GB, new"
   ↓
4. Main Agent: Generates "FINAL_QUERY: iPhone 16 256GB new"
   ↓
5. Research Agent (MCP):
   - Searches web for "iPhone 16"
   - Verifies: exists=true, release_status=available
   - Returns: "iPhone 16 released September 2024"
   ↓
6. eBay Agent (MCP):
   - Calls eBay Browse API
   - Returns 4 product listings
   ↓
7. Amazon Agent (MCP):
   - Calls Rainforest API
   - Returns 4 product listings
   ↓
8. Main Agent:
   - Combines results
   - Returns to frontend
   ↓
9. Frontend: Displays eBay + Amazon results
```

## 🛠️ Technology Stack

### Backend
- **Framework**: FastAPI (async)
- **Protocol**: Model Context Protocol (MCP)
- **AI Models**: OpenRouter (Google Gemini, Anthropic Claude, etc.)
- **APIs**: eBay Browse API, Rainforest API, Serper API

### Frontend
- **HTML/CSS/JavaScript** (Vanilla)
- **No framework** - Simple and fast

### MCP Infrastructure
- **MCP SDK**: Python MCP library
- **Communication**: stdio (standard input/output)
- **Format**: JSON-RPC

## 📁 Project Structure

```
version_1/
├── agents/                      # Core agent logic
│   ├── __init__.py
│   ├── search_agents.py        # eBay + Amazon search classes
│   └── research_agent.py       # Product verification class
│
├── mcp_servers/                 # MCP server wrappers
│   ├── research_server.py      # Research agent MCP server
│   ├── ebay_server.py          # eBay search MCP server
│   └── amazon_server.py        # Amazon search MCP server
│
├── api.py                       # Original API (backup)
├── api_mcp.py                   # MCP-based API (current)
├── mcp_client.py                # MCP client manager
│
├── index.html                   # Frontend UI
├── style.css                    # Styling
│
├── mcp_config.json              # MCP server configuration
├── start_mcp_servers.sh         # Startup script
│
├── requirements.txt             # Python dependencies
├── .env                         # API keys (gitignored)
├── .gitignore                   # Git ignore rules
│
└── docs/
    ├── README.md                # Main documentation
    ├── MCP_GUIDE.md             # MCP setup & testing
    └── BUGFIXES.md              # Bug fix history
```

## 🔑 API Keys Required

```bash
# Main Agent
MAIN_AGENT_API_KEY=sk-or-v1-xxxxx

# Research Agent
RESEARCH_AGENT_API_KEY=sk-or-v1-xxxxx
SERPER_API_KEY=your_serper_key

# eBay Agent
EBAY_CLIENT_ID=your_ebay_id
EBAY_CLIENT_SECRET=your_ebay_secret

# Amazon Agent
RAINFOREST_API_KEY=your_rainforest_key
```

## 🚀 Running the Application

### Start MCP Servers:
```bash
./start_mcp_servers.sh
```

### Start Main API:
```bash
python3 api_mcp.py
```

### Start Frontend:
```bash
python3 -m http.server 3000
```

Open: `http://localhost:3000`

## ✅ MCP Architecture Benefits

1. **Microservices** - Each agent runs independently
2. **Fault Isolation** - One agent crash doesn't affect others
3. **Scalability** - Easy to add new agents
4. **Testing** - Test each agent independently
5. **Deployment** - Deploy agents separately
6. **Standardization** - Industry-standard protocol (MCP)
7. **Hot Reload** - Restart agents without restarting main API

## 🔮 Future Enhancements

- [ ] Price Comparison Agent (analyze best deals)
- [ ] Review Analysis Agent (summarize reviews)
- [ ] Inventory Checker Agent (check stock availability)
- [ ] Price History Agent (track price trends)
- [ ] Recommendation Agent (suggest alternatives)

## 📚 References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [OpenRouter](https://openrouter.ai/)

---

**Architecture Version**: 2.0 (MCP-based)  
**Last Updated**: November 22, 2025
