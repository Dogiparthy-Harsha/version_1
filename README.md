# AI-Powered Shopping Assistant

An intelligent shopping assistant that helps users find the best deals on eBay and Amazon using conversational AI and real-time product verification.

## 🏗️ Architecture

This project uses a **multi-agent architecture**:

### 1. **Main Conversational Agent** (`api.py`)
- Handles user conversation
- Asks clarifying questions to refine search
- Generates final search queries
- Coordinates with other agents

### 2. **Research Agent** (`research_agent.py`)
- Verifies product existence using web search (Serper API)
- Checks if products are currently available
- Provides confidence ratings on product information
- Runs **AFTER** the final query is generated but **BEFORE** hitting eBay/Amazon APIs

### 3. **Search Agents** (`ebay_search.py`)
- eBay Search: Queries eBay Browse API
- Amazon Search: Queries Rainforest API

## 🔄 Workflow

```
User Message
    ↓
Main Agent (asks clarifying questions)
    ↓
User provides details
    ↓
Main Agent generates FINAL_QUERY
    ↓
Research Agent verifies product ← Web Search (Serper)
    ↓
    ├─ Product exists → Continue to search
    │   ↓
    │   eBay API + Amazon API
    │   ↓
    │   Display results to user
    │
    └─ Product doesn't exist → Ask user to clarify or search anyway
```

## 🚀 Setup Instructions

### 1. Create Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate it (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure API Keys

Create a `.env` file in the project root with the following keys:

```bash
# Required
EBAY_CLIENT_ID=your_ebay_client_id
EBAY_CLIENT_SECRET=your_ebay_client_secret
OPENROUTER_API_KEY=your_openrouter_api_key
RAINFOREST_API_KEY=your_rainforest_api_key

# Optional (for product verification)
SERPER_API_KEY=your_serper_api_key
```

#### Where to get API keys:

- **eBay**: https://developer.ebay.com/
- **OpenRouter**: https://openrouter.ai/
- **Rainforest**: https://www.rainforestapi.com/
- **Serper** (optional): https://serper.dev (2,500 free searches/month)

### 3. Run the Application

**Terminal 1 - Backend:**
```bash
# Make sure virtual environment is activated
source venv/bin/activate

# Start the API server
python3 api.py
```

**Terminal 2 - Frontend:**
```bash
# Option A: Simple HTTP server
python3 -m http.server 3000

# Option B: Just open the file
open index.html
```

Then open your browser to:
- Frontend: `http://localhost:3000`
- Backend API: `http://127.0.0.1:8000`

## 🧠 AI Models

The system uses **OpenRouter** to access various AI models. Current configuration:

- **Main Agent**: `google/gemini-2.5-pro` (better reasoning, recent knowledge)
- **Research Agent**: `google/gemini-2.5-flash-lite` (fast analysis)

### Available Models

You can change the model in `api.py` (line ~143). Popular options:

| Model | Best For | Cost |
|-------|----------|------|
| `google/gemini-2.5-pro` | Complex reasoning, recent knowledge | Medium |
| `anthropic/claude-3.5-sonnet` | Nuanced conversation, code | Higher |
| `openai/gpt-4o-mini` | General tasks, cheap | Low |
| `meta-llama/Meta-Llama-3.1-70B-Instruct` | Open-source, instruction following | Medium |

See full list: https://openrouter.ai/models

## 🔍 Research Agent (Product Verification)

The Research Agent is **optional** but highly recommended. It:

1. ✅ Verifies products exist before searching
2. ✅ Prevents wasted API calls on non-existent products
3. ✅ Provides current information (release dates, specs)
4. ✅ Works with ANY product category (not just electronics)

**How it works:**
- When the main agent generates a `FINAL_QUERY`, the research agent searches the web
- It analyzes search results using AI to determine if the product exists
- If the product doesn't exist with high confidence, it asks the user for clarification
- Otherwise, it proceeds with eBay/Amazon searches

**To enable:** Add `SERPER_API_KEY` to your `.env` file

## 📁 Project Structure

```
version_1/
├── api.py                  # Main FastAPI backend + conversational agent
├── research_agent.py       # Product verification agent
├── ebay_search.py         # eBay and Amazon search logic
├── index.html             # Frontend UI
├── style.css              # Styling
├── requirements.txt       # Python dependencies
├── .env                   # API keys (not in git)
└── README.md             # This file
```

## 🛠️ Troubleshooting

### Research Agent not working?
- Check that `SERPER_API_KEY` is in your `.env` file
- Restart the backend server after adding the key
- You should see "Initializing Research Agent with web search..." on startup

### "Product doesn't exist" errors?
- The research agent is being cautious
- You can choose to "search anyway" when prompted
- Or refine your query to be more specific

### Frontend can't connect to backend?
- Make sure backend is running on `http://127.0.0.1:8000`
- Check browser console for CORS errors
- Verify CORS is enabled in `api.py` (it should be by default)

## 🎯 Features

- ✅ Conversational AI that asks clarifying questions
- ✅ Multi-agent architecture (Main + Research agents)
- ✅ Real-time product verification via web search
- ✅ Searches both eBay and Amazon simultaneously
- ✅ Date-aware (knows current date for product availability)
- ✅ Works with any product category (electronics, clothes, furniture, etc.)
- ✅ Prevents wasted API calls on non-existent products
- ✅ Clean, modern UI

## 📝 Example Conversation

```
User: "I want an iPhone 17"
Agent: "What storage capacity are you looking for? And are you interested in new or used condition?"

User: "1000$, iPhone 17"
Agent: "Are you looking for the iPhone 16, iPhone 16 Plus, iPhone 16 Pro, or iPhone 16 Pro Max?"

User: "iPhone 16"
[Research Agent verifies "iPhone 16" exists]
[Searches eBay and Amazon]
[Displays results]
```

## 🔮 Future Enhancements

- [ ] Add price comparison and recommendations
- [ ] Support for more marketplaces (Walmart, Best Buy, etc.)
- [ ] User preferences and search history
- [ ] Price tracking and alerts
- [ ] Image-based product search
- [ ] Multi-language support

## 📄 License

This project is for educational purposes (CMPE 295A).

---

**Built with ❤️ using FastAPI, OpenRouter, and multi-agent AI architecture**
