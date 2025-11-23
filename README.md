# AI-Powered Shopping Assistant (MCP Architecture)

An intelligent shopping assistant that helps users find the best deals on eBay and Amazon using **multi-agent architecture** powered by the **Model Context Protocol (MCP)**.

## 🌟 Features

- ✅ **User Authentication** - Secure JWT-based login/register with bcrypt password hashing
- ✅ **Chat History** - Persistent conversation history with SQLite database
- ✅ **Multiple Conversations** - Sidebar to manage and switch between chats
- ✅ **Conversational AI** - Natural language product search
- ✅ **Multi-Agent System** - Independent agents for different tasks
- ✅ **Product Verification** - Real-time web search to verify products exist
- ✅ **Dual Marketplace** - Searches both eBay and Amazon simultaneously
- ✅ **Smart Filtering** - Blocks unreleased/rumored products
- ✅ **Results Persistence** - Search results saved with conversations
- ✅ **MCP Protocol** - Industry-standard microservices architecture
- ✅ **Date-Aware** - Knows current date for product availability
- ✅ **Works with Any Product** - Electronics, clothes, furniture, etc.

## 🏗️ Architecture

This project uses **Model Context Protocol (MCP)** for a microservices-based architecture:

```
Frontend → Main API → MCP Client → [Research Agent | eBay Agent | Amazon Agent]
```

- **Main Agent**: Handles conversation and generates search queries
- **Research Agent**: Verifies products via web search (Serper API)
- **eBay Agent**: Searches eBay Browse API
- **Amazon Agent**: Searches Amazon via Rainforest API

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for detailed system design.

## 🚀 Quick Start

### 1. Install Backend Dependencies

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Mac/Linux

# Install Python packages
pip install -r requirements.txt
```

### 2. Install Frontend Dependencies

```bash
# Navigate to frontend directory
cd frontend

# Install Node packages
npm install

# Go back to root
cd ..
```

### 3. Configure API Keys

Create a `.env` file:

```bash
# Main Agent
MAIN_AGENT_API_KEY=your_openrouter_key

# Research Agent
RESEARCH_AGENT_API_KEY=your_openrouter_key
SERPER_API_KEY=your_serper_key

# eBay Agent
EBAY_CLIENT_ID=your_ebay_client_id
EBAY_CLIENT_SECRET=your_ebay_client_secret

# Amazon Agent
RAINFOREST_API_KEY=your_rainforest_key
```

**Where to get keys:**
- **OpenRouter**: https://openrouter.ai/keys
- **Serper**: https://serper.dev (2,500 free searches/month)
- **eBay**: https://developer.ebay.com/
- **Rainforest**: https://www.rainforestapi.com/

> **⚠️ IMPORTANT:** The `.env` file is **required** and **not included** in the repository for security reasons. You must create it manually with your own API keys before running the application.

> **💾 Note:** The SQLite database (`app.db`) will be automatically created when you first run the backend. No manual database setup is required.

### 4. Start the Application (3 Terminals Required)

You need **3 separate terminal windows/tabs**, all with the virtual environment activated.

#### **Terminal 1: MCP Servers**

```bash
# Navigate to project directory
cd /path/to/version_1

# Activate virtual environment
source venv/bin/activate  # On Mac/Linux
# OR
venv\Scripts\activate     # On Windows

# Make script executable (first time only)
chmod +x start_mcp_servers.sh

# Start all MCP servers
./start_mcp_servers.sh
```

**Expected output:**
```
✓ All HTTP MCP servers started!
Research Agent: http://127.0.0.1:8001 (PID: xxxxx)
eBay Search:    http://127.0.0.1:8002 (PID: xxxxx)
Amazon Search:  http://127.0.0.1:8003 (PID: xxxxx)
```

**Keep this terminal running!** ✋

---

#### **Terminal 2: Main API**

```bash
# Navigate to project directory
cd /path/to/version_1

# Activate virtual environment
source venv/bin/activate  # On Mac/Linux
# OR
venv\Scripts\activate     # On Windows

# Start main API server
python3 api_mcp.py
```

**Expected output:**
```
Initializing OpenRouter AI for main agent...
Starting Main API Server (HTTP-based MCP) at http://127.0.0.1:8000
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

**Keep this terminal running!** ✋

---

#### **Terminal 3: React Frontend**

```bash
# Navigate to frontend directory
cd /path/to/version_1/frontend

# Start React dev server
npm run dev
```

**Expected output:**
```
VITE v7.2.4  ready in 334 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

**Keep this terminal running!** ✋

---

#### **Open Browser**

Go to: **http://localhost:5173**

**First Time Setup:**
1. You'll see a login screen
2. Click "Register here" to create an account
3. Enter a username and password (min 8 chars, must include uppercase, lowercase, number, and special character)
4. After registration, you'll be automatically logged in

**Returning Users:**
- Simply login with your credentials
- Your chat history will be preserved across sessions

Start chatting with the AI shopping assistant! 🛍️

---

### 5. Stopping the Application

Press `Ctrl+C` in each terminal to stop the servers.

Or kill all MCP servers at once:
```bash
pkill -f 'mcp_servers'
```

## 📖 Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design
- **[MCP_GUIDE.md](MCP_GUIDE.md)** - MCP setup, testing, and troubleshooting
- **[BUGFIXES.md](BUGFIXES.md)** - Bug fix history and solutions

## 🎯 Example Usage

```
User: "I want an iPhone"
Agent: "What storage capacity are you looking for? And new or used?"

User: "256GB, new"
Agent: "Are you looking for iPhone 16, 16 Plus, 16 Pro, or 16 Pro Max?"

User: "iPhone 16"
[Research Agent verifies product exists]
[Searches eBay and Amazon]
[Displays results from both platforms]
```

### Smart Product Verification

```
User: "Samsung S26 Ultra"
Agent: "The 'Samsung S26 Ultra' hasn't been released yet. 
       Expected in early 2026. Would you like to search for 
       a currently available alternative?"
```

## 🛠️ Technology Stack

### Backend
- **FastAPI** - Async web framework
- **MCP** - Model Context Protocol for microservices
- **OpenRouter** - AI model access (Gemini, Claude, etc.)
- **Python 3.13+**

### Frontend
- **React** - Component-based UI library
- **Vite** - Fast build tool and dev server
- **Axios** - HTTP client for API calls
- **React Markdown** - Markdown rendering in chat
- **Modern CSS** - Dark theme with gradients and animations

### APIs
- **eBay Browse API** - Product search
- **Rainforest API** - Amazon search
- **Serper API** - Web search for verification
- **OpenRouter API** - AI models

## 📁 Project Structure

```
version_1/
├── agents/                  # Core agent logic
│   ├── search_agents.py    # eBay + Amazon search
│   └── research_agent.py   # Product verification
│
├── mcp_servers/             # MCP server implementations
│   ├── research_server.py  # Research agent HTTP server
│   ├── ebay_server.py      # eBay search HTTP server
│   └── amazon_server.py    # Amazon search HTTP server
│
├── frontend/                # React frontend
│   ├── src/
│   │   ├── App.jsx         # Main React component
│   │   ├── App.css         # Component styles
│   │   └── index.css       # Global styles
│   ├── package.json        # Node dependencies
│   └── vite.config.js      # Vite configuration
│
├── api_mcp.py               # Main FastAPI backend (MCP)
├── start_mcp_servers.sh     # MCP servers startup script
├── requirements.txt         # Python dependencies
├── .env                     # API keys (gitignored)
│
└── docs/                    # Documentation
    ├── README.md
    ├── ARCHITECTURE.md
    ├── MCP_GUIDE.md
    └── BUGFIXES.md
```

## 🧪 Testing

### Test Individual MCP Servers

```bash
# Test Research Agent
python3 mcp_servers/research_server.py

# Test eBay Search
python3 mcp_servers/ebay_server.py

# Test Amazon Search
python3 mcp_servers/amazon_server.py
```

### Test Products

**Should work** (currently available):
- iPhone 16 Pro Max
- Samsung Galaxy S24 Ultra
- MacBook Pro M3

**Should be blocked** (not released):
- iPhone 17
- Samsung S26 Ultra
- PlayStation 6

## 🐛 Troubleshooting

### "MCP servers not connected"
- Make sure MCP servers are running first
- Check: `ps aux | grep mcp_servers`

### "Module 'mcp' not found"
```bash
pip install mcp
```

### "SERPER_API_KEY not found"
- Add it to `.env` file
- Research agent will work with limited functionality

### eBay results not showing
- Check eBay API token hasn't expired
- Restart the eBay MCP server

See [MCP_GUIDE.md](MCP_GUIDE.md) for detailed troubleshooting.

## 🔮 Future Enhancements

- [ ] Price Comparison Agent (analyze best deals)
- [ ] Review Analysis Agent (summarize reviews)
- [ ] Inventory Checker Agent (check stock)
- [ ] Price History Agent (track trends)
- [ ] Multi-language support
- [ ] Image-based search
- [ ] Price alerts

## 📄 License

This project is for educational purposes (CMPE 295A).

## 🙏 Acknowledgments

- **Model Context Protocol** by Anthropic
- **OpenRouter** for AI model access
- **eBay** and **Amazon** for product APIs
- **Serper** for web search API

---

**Built with ❤️ using FastAPI, MCP, and multi-agent AI architecture**

**Version**: 2.0 (MCP-based)  
**Last Updated**: November 22, 2025
