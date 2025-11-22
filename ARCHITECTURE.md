# Multi-Agent Architecture Flow

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                        (index.html)                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP POST /chat
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MAIN CONVERSATIONAL AGENT                    │
│                         (api.py)                                │
│                                                                 │
│  1. Receives user message                                       │
│  2. Asks clarifying questions (model, color, budget, etc.)      │
│  3. Generates FINAL_QUERY when ready                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ FINAL_QUERY generated
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RESEARCH AGENT                             │
│                   (research_agent.py)                           │
│                                                                 │
│  1. Receives final query                                        │
│  2. Searches web via Serper API ──────────┐                     │
│  3. Analyzes results with AI              │                     │
│  4. Returns verification:                 │                     │
│     - exists: true/false                  │                     │
│     - info: product details               │                     │
│     - confidence: high/medium/low         │                     │
└────────────────────────┬──────────────────┼─────────────────────┘
                         │                  │
                         │                  │
                    ┌────┴────┐             │
                    │         │             │
         Product    │  Product│             │
         doesn't    │  exists │             │
         exist      │         │             │
                    │         │             │
                    ▼         ▼             │
            ┌──────────┐  ┌──────────────────────────┐
            │   Ask    │  │   Search eBay + Amazon   │
            │   User   │  │                          │
            │  Clarify │  │  ┌────────────────────┐  │
            └──────────┘  │  │   eBay Browse API  │  │
                          │  └────────────────────┘  │
                          │  ┌────────────────────┐  │
                          │  │  Rainforest API    │  │
                          │  │  (Amazon)          │  │
                          │  └────────────────────┘  │
                          └────────────┬─────────────┘
                                       │
                                       │ Results
                                       ▼
                          ┌─────────────────────────┐
                          │   Display Results to    │
                          │   User (eBay + Amazon)  │
                          └─────────────────────────┘
```

## Agent Responsibilities

### 🤖 Main Agent (api.py)
- **Model**: `google/gemini-2.5-pro`
- **Purpose**: Conversation management
- **Tasks**:
  - Understand user intent
  - Ask 1-2 clarifying questions
  - Generate final search query
  - Coordinate with research agent
  - Format and return results

### 🔍 Research Agent (research_agent.py)
- **Model**: `google/gemini-2.5-flash-lite` (fast analysis)
- **Purpose**: Product verification
- **Tasks**:
  - Search web for product information
  - Verify product exists
  - Check release dates and availability
  - Provide confidence ratings
  - **Runs ONLY when FINAL_QUERY is ready**

### 🛒 Search Agents (ebay_search.py)
- **eBay Agent**: Queries eBay Browse API
- **Amazon Agent**: Queries Rainforest API
- **Purpose**: Fetch actual product listings
- **Runs ONLY if research agent confirms product exists**

## Key Design Decisions

### ✅ Why Research Agent Runs AFTER Final Query?

1. **Efficiency**: Don't waste web search API calls during conversation
2. **Accuracy**: Verify the exact query user wants, not intermediate messages
3. **Cost**: Web search APIs have usage limits
4. **User Experience**: Faster conversation flow

### ✅ Why Multi-Agent Architecture?

1. **Separation of Concerns**: Each agent has a specific job
2. **Modularity**: Easy to add/remove/upgrade agents
3. **Scalability**: Can run agents in parallel or distributed
4. **Maintainability**: Easier to debug and test individual agents

## Example Flow

```
User: "I want an iPhone 17"
  ↓
Main Agent: "What storage capacity? New or used?"
  ↓
User: "1000$, iPhone 17"
  ↓
Main Agent: Generates "FINAL_QUERY: iPhone 17 1TB new under $1000"
  ↓
Research Agent: 
  - Searches web for "iPhone 17"
  - Finds: "iPhone 17 not released yet, latest is iPhone 16"
  - Returns: exists=false, confidence=high
  ↓
Main Agent: "I couldn't find iPhone 17. Latest is iPhone 16. Search anyway?"
  ↓
User: "Yes, iPhone 16"
  ↓
Main Agent: Generates "FINAL_QUERY: iPhone 16 1TB new under $1000"
  ↓
Research Agent: 
  - Searches web for "iPhone 16"
  - Finds: "iPhone 16 released September 2024"
  - Returns: exists=true, confidence=high
  ↓
eBay API + Amazon API: Search for products
  ↓
Display Results to User
```

## API Call Flow

```
Frontend                Main Agent              Research Agent         External APIs
   │                        │                         │                      │
   ├─── POST /chat ────────>│                         │                      │
   │                        │                         │                      │
   │                        ├─ Ask questions ────────>│                      │
   │<─── Response ──────────┤                         │                      │
   │                        │                         │                      │
   ├─── POST /chat ────────>│                         │                      │
   │    (more details)      │                         │                      │
   │                        │                         │                      │
   │                        ├─ Generate FINAL_QUERY   │                      │
   │                        │                         │                      │
   │                        ├─ verify_product() ─────>│                      │
   │                        │                         ├─ Web Search ───────>│
   │                        │                         │<─ Search Results ────┤
   │                        │                         │                      │
   │                        │                         ├─ AI Analysis        │
   │                        │<─ Verification Result ──┤                      │
   │                        │                         │                      │
   │                        ├─ Search eBay ──────────────────────────────────>│
   │                        ├─ Search Amazon ────────────────────────────────>│
   │                        │<─ eBay Results ──────────────────────────────────┤
   │                        │<─ Amazon Results ────────────────────────────────┤
   │                        │                         │                      │
   │<─── Display Results ───┤                         │                      │
```

## Configuration

All agents are configured in `api.py`:

```python
# Main Agent
ai_client = OpenAI(
    model="google/gemini-2.5-pro",  # Can be changed
    ...
)

# Research Agent (optional)
research_agent = ResearchAgent(
    openrouter_api_key=OPENROUTER_API_KEY,
    serper_api_key=SERPER_API_KEY  # Optional
)
```

## Future Enhancements

- [ ] **Price Comparison Agent**: Analyzes prices and recommends best deals
- [ ] **Review Analysis Agent**: Summarizes product reviews
- [ ] **Recommendation Agent**: Suggests alternative products
