# AI Shopping Assistant - MCP Architecture

## 🏗️ System Architecture

This project uses **Model Context Protocol (MCP)** for a microservices-based multi-agent architecture with **RAG (Retrieval-Augmented Generation)** for personalized recommendations.

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React + Vite)                    │
│                    Port 5173 (Vite HMR)                      │
│  - User Authentication UI                                   │
│  - Chat Interface with History Sidebar                      │
│  - Product Results Display                                  │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST API
                         │ JWT Authentication
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Main API (FastAPI)                         │
│                      api_mcp.py                              │
│                      Port 8000                               │
│                                                              │
│  - User Authentication (JWT + bcrypt)                       │
│  - Conversation Management                                  │
│  - RAG Context Retrieval                                    │
│  - MCP Agent Coordination                                   │
└──┬───────────────┬──────────────┬──────────────┬────────────┘
   │               │              │              │
   │               │              │              │ MCP Protocol
   │               │              │              │ (HTTP)
   │               │              ▼              ▼
   │               │    ┌────────────────┐ ┌────────────┐
   │               │    │ Research Agent │ │ eBay Agent │
   │               │    │  MCP Server    │ │ MCP Server │
   │               │    │   Port 8001    │ │ Port 8002  │
   │               │    └────────┬───────┘ └─────┬──────┘
   │               │             │               │
   │               │             ▼               ▼
   │               │    ┌────────────────┐ ┌────────────┐
   │               │    │ Amazon Agent   │ │ Serper API │
   │               │    │  MCP Server    │ │ (Web       │
   │               │    │   Port 8003    │ │  Search)   │
   │               │    └────────┬───────┘ └────────────┘
   │               │             │
   │               │             ▼
   │               │    ┌─────────────────────┐
   │               │    │ eBay Browse API     │
   │               │    │ Rainforest API      │
   │               │    └─────────────────────┘
   │               │
   ▼               ▼
┌──────────┐  ┌──────────────────┐
│ SQLite   │  │ Pinecone Vector  │
│ Database │  │    Database      │
│          │  │                  │
│ - users  │  │ - chat-history   │
│ - convos │  │   (1536 dims)    │
│ - chats  │  │ - cosine metric  │
└──────────┘  └────────┬─────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ OpenAI API      │
              │ (Embeddings)    │
              │ text-embedding  │
              │   -3-small      │
              └─────────────────┘
```

## 🎯 Agent Responsibilities

### 1. **Main Conversational Agent** (`api_mcp.py`)
- **Model**: `google/gemini-2.5-flash-lite`
- **Purpose**: User interaction, query generation, and RAG coordination
- **Tasks**:
  - User authentication and session management
  - Understand user intent
  - **Retrieve personalized context from Pinecone (RAG)**
  - Ask clarifying questions (model, color, budget, etc.)
  - Generate final search query
  - Coordinate with MCP agents
  - Store messages in Pinecone for future personalization
  - Format and return results

### 2. **RAG (Retrieval-Augmented Generation)** (`embeddings.py`)
- **Vector Database**: Pinecone (serverless)
- **Embedding Model**: OpenAI `text-embedding-3-small` (1536 dimensions)
- **Purpose**: Personalize AI responses based on user's search history
- **Tasks**:
  - Generate vector embeddings for chat messages
  - Store user and assistant messages in Pinecone
  - Semantic search across user's past conversations
  - **User isolation**: Filter by `user_id` metadata
  - Return relevant context for AI prompt enhancement
- **Privacy**: Each user's data is completely isolated via metadata filtering

### 3. **Research Agent** (MCP Server)
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

### 4. **eBay Search Agent** (MCP Server)
- **Location**: `mcp_servers/ebay_server.py`
- **Core Logic**: `agents/search_agents.py` (eBaySearch class)
- **Purpose**: Search eBay for products
- **Tools**:
  - `search_ebay` - Search eBay Browse API
- **Tasks**:
  - Authenticate with eBay API
  - Search for products
  - Return: title, price, condition, URL, image

### 5. **Amazon Search Agent** (MCP Server)
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

### Example: User searches for "iPhone" (with RAG personalization)

```
1. User: "I want an iPhone"
   ↓
2. Main Agent:
   - Retrieves RAG context from Pinecone
   - Finds: User previously searched for "iPhone 15 Pro 256GB"
   - Enhanced prompt: "User has searched for iPhones before"
   ↓
3. Main Agent (Personalized): "Looking for another iPhone? 
   I see you searched for iPhone 15 Pro before. 
   What storage capacity this time?"
   ↓
4. User: "512GB this time"
   ↓
5. Main Agent: Generates "FINAL_QUERY: iPhone 512GB"
   ↓
6. Research Agent (MCP):
   - Searches web for "iPhone"
   - Verifies: exists=true, release_status=available
   - Returns: "iPhone 16 released September 2024"
   ↓
7. eBay Agent (MCP):
   - Calls eBay Browse API
   - Returns 4 product listings
   ↓
8. Amazon Agent (MCP):
   - Calls Rainforest API
   - Returns 4 product listings
   ↓
9. Main Agent:
   - Combines results
   - Stores user message + AI response in Pinecone (for next time)
   - Returns to frontend
   ↓
10. Frontend: Displays eBay + Amazon results
```

### RAG Timing (Critical for Accuracy)

```
┌─────────────────────────────────────┐
│ User sends message                  │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 1. Save to SQLite                   │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 2. Retrieve RAG context             │
│    (from PAST messages only)        │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 3. AI generates response            │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 4. Save AI response to SQLite       │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 5. Store BOTH messages in Pinecone  │
│    (for NEXT conversation)          │
└─────────────────────────────────────┘
```

**Why this order matters:**
- Storing messages in Pinecone AFTER AI response prevents the current message from appearing as "past history"
- Ensures RAG only retrieves actual previous conversations, not the current one

## 🛠️ Technology Stack

### Backend
- **Framework**: FastAPI (async)
- **Protocol**: Model Context Protocol (MCP) over HTTP
- **AI Models**: OpenRouter (Google Gemini, Anthropic Claude, etc.)
- **APIs**: eBay Browse API, Rainforest API, Serper API
- **Database**: SQLite (users, conversations, chats)
- **Vector Database**: Pinecone (serverless, 1536 dimensions)
- **Embeddings**: OpenAI `text-embedding-3-small`
- **Authentication**: JWT + bcrypt

### Frontend
- **Framework**: React 18 with Vite
- **Build Tool**: Vite (fast HMR)
- **Styling**: Vanilla CSS
- **State Management**: React Context API (AuthContext)
- **Markdown**: ReactMarkdown for AI responses

### MCP Infrastructure
- **MCP SDK**: Python MCP library
- **Communication**: HTTP/REST (ports 8001-8003)
- **Format**: JSON

### Security
- **Password Hashing**: bcrypt
- **Tokens**: JWT with expiration
- **User Isolation**: Database + Vector DB filtering by `user_id`

## 📁 Project Structure

```
version_1/
├── agents/                      # Core agent logic
│   ├── __init__.py
│   ├── search_agents.py        # eBay + Amazon search classes
│   └── research_agent.py       # Product verification class
│
├── mcp_servers/                 # MCP server wrappers
│   ├── research_server.py      # Research agent MCP server (Port 8001)
│   ├── ebay_server.py          # eBay search MCP server (Port 8002)
│   └── amazon_server.py        # Amazon search MCP server (Port 8003)
│
├── frontend/                    # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx       # Login/Register UI
│   │   │   └── Sidebar.jsx     # Conversation history
│   │   ├── context/
│   │   │   └── AuthContext.jsx # Auth state management
│   │   ├── App.jsx             # Main app component
│   │   ├── App.css             # Styling
│   │   ├── ErrorBoundary.jsx   # Error handling
│   │   └── main.jsx            # Entry point
│   ├── package.json
│   └── vite.config.js
│
├── api_mcp.py                   # Main API with RAG (Port 8000)
├── embeddings.py                # RAG embedding service
├── backfill_pinecone.py         # Migrate existing data to Pinecone
├── auth.py                      # Authentication logic
├── models.py                    # SQLAlchemy models
├── database.py                  # Database configuration
│
├── start_all.sh                 # Unified startup script
├── start_mcp_servers.sh         # MCP servers startup
│
├── requirements.txt             # Python dependencies
├── .env                         # API keys (gitignored)
├── .gitignore                   # Git ignore rules
├── app.db                       # SQLite database (gitignored)
│
├── logs/                        # Service logs (gitignored)
│   ├── mcp_servers.log
│   ├── api.log
│   └── frontend.log
│
├── README.md                    # Main documentation
├── ARCHITECTURE.md              # This file
└── MCP_GUIDE.md                 # MCP setup & testing
```

## 🔑 API Keys Required

```bash
# Main Agent (OpenRouter)
MAIN_AGENT_API_KEY=sk-or-v1-xxxxx

# Research Agent
RESEARCH_AGENT_API_KEY=sk-or-v1-xxxxx
SERPER_API_KEY=your_serper_key

# eBay Agent
EBAY_CLIENT_ID=your_ebay_id
EBAY_CLIENT_SECRET=your_ebay_secret

# Amazon Agent
RAINFOREST_API_KEY=your_rainforest_key

# RAG (Retrieval-Augmented Generation)
OPENAI_API_KEY=sk-proj-xxxxx
PINECONE_API_KEY=pcsk_xxxxx
PINECONE_ENVIRONMENT=us-east-1
```

## 🚀 Running the Application

### Quick Start (Recommended):
```bash
./start_all.sh
```

This single command:
- Activates virtual environment
- Starts all MCP servers (ports 8001-8003)
- Starts backend API (port 8000)
- Starts frontend (port 5173)
- Creates log files in `logs/` directory
- Handles graceful shutdown with Ctrl+C

### Manual Start (for debugging):

**Terminal 1 - MCP Servers:**
```bash
./start_mcp_servers.sh
```

**Terminal 2 - Backend API:**
```bash
source venv/bin/activate
python3 api_mcp.py
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

**Access:** http://localhost:5173

## ✅ MCP Architecture Benefits

1. **Microservices** - Each agent runs independently
2. **Fault Isolation** - One agent crash doesn't affect others
3. **Scalability** - Easy to add new agents
4. **Testing** - Test each agent independently
5. **Deployment** - Deploy agents separately
6. **Standardization** - Industry-standard protocol (MCP)
7. **Hot Reload** - Restart agents without restarting main API
8. **RAG Personalization** - Context-aware responses from user history
9. **User Privacy** - Complete data isolation per user

## 🔮 Future Enhancements

- [ ] Price Comparison Agent (analyze best deals)
- [ ] Review Analysis Agent (summarize reviews)
- [ ] Inventory Checker Agent (check stock availability)
- [ ] Price History Agent (track price trends)
- [ ] Recommendation Agent (suggest alternatives)
- [ ] Budget Tracking (monitor spending across searches)
- [ ] Wishlist with Price Alerts
- [ ] PostgreSQL migration for production scale
- [ ] Redis caching layer
- [ ] Rate limiting and API quotas

## 📚 References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [OpenRouter](https://openrouter.ai/)
- [Pinecone Documentation](https://docs.pinecone.io/)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)

---

**Architecture Version**: 3.0 (MCP + RAG)  
**Last Updated**: November 25, 2025
