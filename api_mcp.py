#!/usr/bin/env python3
"""
Backend API Server (FastAPI) - HTTP-based MCP Architecture
Connects to HTTP MCP servers for research, eBay, and Amazon
"""

import os
import uvicorn
import httpx
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from openai import OpenAI

# Load API Keys
from dotenv import load_dotenv
load_dotenv()

OPENROUTER_API_KEY = os.environ.get("MAIN_AGENT_API_KEY") or os.environ.get("OPENROUTER_API_KEY")

# MCP Server URLs
RESEARCH_AGENT_URL = "http://127.0.0.1:8001"
EBAY_AGENT_URL = "http://127.0.0.1:8002"
AMAZON_AGENT_URL = "http://127.0.0.1:8003"

# Initialize FastAPI
app = FastAPI()

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenRouter AI
print("Initializing OpenRouter AI for main agent...")
ai_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
    default_headers={
        "HTTP-Referer": "http://localhost",
        "X-Title": "Shopping-Assistant-MCP"
    },
)

# HTTP client for MCP servers
http_client = httpx.AsyncClient(timeout=30.0)


# Request/Response Models
class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]]


class ChatResponse(BaseModel):
    type: str
    message: str
    history: List[Dict[str, str]]
    results: Optional[Dict] = None


@app.post("/chat", response_model=ChatResponse)
async def handle_chat(request: ChatRequest):
    
    # System prompt
    current_date = datetime.now().strftime("%B %d, %Y")
    system_prompt = (
        f"You are a helpful search assistant for eBay and Amazon. Today's date is {current_date}. "
        "Your goal is to ask the user 1-2 follow-up questions to get key details "
        "(like model, color, size, condition, storage, or budget) to refine their search. "
        "Once you have enough details, your *very last* message must ONLY be the "
        "final search query, prefixed with 'FINAL_QUERY:'. "
        "For example: 'FINAL_QUERY: iPhone 15 Pro Max 256GB new'. "
        "IMPORTANT: Do not make assumptions about product availability. Focus on gathering search details."
    )
    welcome_message = "Greetings, I will help you find the best deals on eBay and Amazon. What are you looking for today?"
    
    # Handle initial welcome
    if not request.message and not request.history:
        print("INFO: Sending initial welcome message")
        return ChatResponse(
            type="question",
            message=welcome_message,
            history=[
                {"role": "system", "content": system_prompt},
                {"role": "assistant", "content": welcome_message}
            ]
        )

    # Prepare chat history
    chat_history = request.history
    chat_history.append({"role": "user", "content": request.message})
    
    # Call AI
    try:
        response = ai_client.chat.completions.create(
            model="google/gemini-2.5-flash-lite",
            messages=chat_history
        )
        ai_message = response.choices[0].message.content.strip()
        chat_history.append({"role": "assistant", "content": ai_message})
        
    except Exception as e:
        print(f"✗ Error communicating with OpenRouter: {e}")
        return ChatResponse(
            type="question",
            message="Sorry, I had an error connecting to the AI. Please try again.",
            history=chat_history
        )

    # Check if it's a final query
    if ai_message.startswith("FINAL_QUERY:"):
        final_query = ai_message.replace("FINAL_QUERY:", "").strip()
        
        # --- Call Research Agent (HTTP) ---
        print(f"🔍 Research Agent (HTTP): Verifying '{final_query}'...")
        try:
            research_response = await http_client.post(
                f"{RESEARCH_AGENT_URL}/verify_product",
                json={"product_name": final_query}
            )
            verification = research_response.json()
            
            release_status = verification.get('release_status', 'unknown')
            print(f"   Release Status: {release_status}")
            
            # Block unreleased products
            if not verification.get('exists') and verification.get('confidence') in ['high', 'medium']:
                print(f"⚠️  Product verification failed: {verification.get('info')}")
                
                if release_status == 'upcoming':
                    message = f"The '{final_query}' hasn't been released yet. {verification.get('info')} Would you like to search for a currently available alternative?"
                elif release_status == 'rumored':
                    message = f"The '{final_query}' is only rumored. {verification.get('info')} Would you like to search anyway, or look for something else?"
                else:
                    message = f"I couldn't find reliable information about '{final_query}'. {verification.get('info')} Would you like to search for something else?"
                
                return ChatResponse(
                    type="question",
                    message=message,
                    history=chat_history
                )
            else:
                print(f"✓ Product verified: {verification.get('info')}")
        except Exception as e:
            print(f"⚠️  Research agent error: {e}")
        
        # --- Search eBay and Amazon (HTTP) ---
        print(f"🔎 Searching eBay and Amazon (HTTP) for: {final_query}")
        
        # Search eBay
        ebay_results = []
        try:
            ebay_response = await http_client.post(
                f"{EBAY_AGENT_URL}/search",
                json={"query": final_query, "limit": 4}
            )
            ebay_data = ebay_response.json()
            ebay_results = ebay_data.get("results", [])
            print(f"✓ Found {len(ebay_results)} eBay results (HTTP)")
        except Exception as e:
            print(f"⚠️  eBay search error: {e}")
        
        # Search Amazon
        amazon_results = []
        try:
            amazon_response = await http_client.post(
                f"{AMAZON_AGENT_URL}/search",
                json={"query": final_query}
            )
            amazon_data = amazon_response.json()
            amazon_results = amazon_data.get("results", [])
            print(f"✓ Found {len(amazon_results)} Amazon results (HTTP)")
        except Exception as e:
            print(f"⚠️  Amazon search error: {e}")

        return ChatResponse(
            type="results",
            message=f"Great! I searched both eBay and Amazon for: '{final_query}'",
            history=chat_history,
            results={"ebay": ebay_results, "amazon": amazon_results}
        )
        
    else:
        # It's a follow-up question
        return ChatResponse(
            type="question",
            message=ai_message,
            history=chat_history
        )


if __name__ == "__main__":
    print("Starting Main API Server (HTTP-based MCP) at http://127.0.0.1:8000")
    uvicorn.run("api_mcp:app", host="127.0.0.1", port=8000, reload=True)
