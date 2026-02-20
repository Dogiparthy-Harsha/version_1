#!/usr/bin/env python3
"""
Backend API Server (FastAPI)
Connects the frontend to the search logic.
"""

import os
import uvicorn
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from openai import OpenAI

# Import agent classes from the agents package
from agents import eBaySearch, RainforestSearch, ResearchAgent

# --- Load API Keys ---
from dotenv import load_dotenv
load_dotenv()

EBAY_CLIENT_ID = os.environ.get("EBAY_CLIENT_ID")
EBAY_CLIENT_SECRET = os.environ.get("EBAY_CLIENT_SECRET")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
RAINFOREST_API_KEY = os.environ.get("RAINFOREST_API_KEY")
SERPER_API_KEY = os.environ.get("SERPER_API_KEY")

# --- Initialize the App ---
app = FastAPI()

# --- Add CORS Middleware ---
# This is CRITICAL to allow your frontend (on a different port)
# to talk to this backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all origins (for development)
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

# --- Initialize API Clients (Globally) ---
# This is efficient. We do it once on startup, not on every request.
print("Authenticating with eBay API...")
ebay = eBaySearch(EBAY_CLIENT_ID, EBAY_CLIENT_SECRET)
ebay.get_access_token()

print("Initializing Rainforest API...")
amazon = RainforestSearch(RAINFOREST_API_KEY)

print("Initializing OpenRouter AI...")
ai_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
    default_headers={
        "HTTP-Referer": "http://localhost",
        "X-Title": "eBay-Amazon-Search"
    },
)

# Initialize Research Agent (optional - only if API key is provided)
research_agent = None
if SERPER_API_KEY:
    print("Initializing Research Agent with web search...")
    research_agent = ResearchAgent(OPENROUTER_API_KEY, SERPER_API_KEY)
else:
    print("⚠️  SERPER_API_KEY not found - Research Agent disabled")
    print("   Get a free key at https://serper.dev for product verification")

# --- Define Request/Response Models ---
class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]]

class ChatResponse(BaseModel):
    type: str # "question", "results", "error"
    message: str
    history: List[Dict[str, str]]
    results: Optional[Dict] = None

class VisionChatRequest(BaseModel):
    image_base64: str
    voice_text: str

# --- API Endpoints ---
# --- API Endpoint ---
@app.post("/chat", response_model=ChatResponse)
async def handle_chat(request: ChatRequest):
    
    # 1. Define prompts
    current_date = datetime.now().strftime("%B %d, %Y")
    
    system_prompt = (
        f"You are a helpful search assistant for eBay and Amazon. Today's date is {current_date}. "
        "Your goal is to ask the user 1-2 follow-up questions to get key details "
        "(like model, color, size, condition, storage, or budget) to refine their search. "
        "Once you have enough details, your *very last* message must ONLY be the "
        "final search query, prefixed with 'FINAL_QUERY:'. "
        "For example: 'FINAL_QUERY: iPhone 15 Pro Max 256GB new'. "
        "IMPORTANT: Do not make assumptions about product availability. If a user asks for a product, "
        "assume it exists and help them search for it. Focus on gathering search details, not questioning whether products exist."
    )
    welcome_message = "Greetings, I will help you find the best deals on eBay and Amazon. What are you looking for today?"
    
    # --- 2. NEW FIX: Handle the initial "hello" from the frontend ---
    if not request.message and not request.history:
        print("INFO: Sending initial welcome message to frontend.")
        return ChatResponse(
            type="question",
            message=welcome_message,
            history=[
                {"role": "system", "content": system_prompt},
                {"role": "assistant", "content": welcome_message}
            ]
        )
    # --- End of new fix ---

    # 3. Prepare Chat History for a real message
    chat_history = request.history
    chat_history.append({"role": "user", "content": request.message})
    
    # 4. Call AI
    try:
        response = ai_client.chat.completions.create(
            model="google/gemini-2.5-flash-lite",  # Upgraded from flash-lite for better accuracy
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

    # 5. Check Response Type
    if ai_message.startswith("FINAL_QUERY:"):
        final_query = ai_message.replace("FINAL_QUERY:", "").strip()
        
        # --- RESEARCH AGENT: Verify product exists before searching ---
        if research_agent:
            print(f"🔍 Research Agent: Verifying '{final_query}' before searching...")
            verification = research_agent.verify_product(final_query)
            
            release_status = verification.get('release_status', 'unknown')
            print(f"   Release Status: {release_status}")
            
            # If product doesn't exist with high confidence, inform the user
            if not verification['exists'] and verification['confidence'] in ['high', 'medium']:
                print(f"⚠️  Product verification failed: {verification['info']}")
                
                # Provide helpful message based on release status
                if release_status == 'upcoming':
                    message = f"The '{final_query}' hasn't been released yet. {verification['info']} Would you like to search for a currently available alternative?"
                elif release_status == 'rumored':
                    message = f"The '{final_query}' is only rumored and not officially confirmed. {verification['info']} Would you like to search anyway, or look for something else?"
                else:
                    message = f"I couldn't find reliable information about '{final_query}'. {verification['info']} Would you like to search for something else?"
                
                return ChatResponse(
                    type="question",
                    message=message,
                    history=chat_history
                )
            else:
                print(f"✓ Product verified: {verification['info']}")
        
        # --- A. It's a Final Query: Run searches ---
        print(f"🔎 Searching eBay and Amazon for: {final_query}")
        ebay_data = ebay.search_items(final_query, limit=4)
        amazon_data = amazon.search_items(final_query)
        
        # --- Parse eBay Results ---
        ebay_results = []
        if ebay_data and "itemSummaries" in ebay_data:
            for item in ebay_data["itemSummaries"][:4]:
                ebay_results.append({
                    "title": item.get("title"),
                    "price": f"{item.get('price', {}).get('value')} {item.get('price', {}).get('currency')}",
                    "condition": item.get("condition"),
                    "url": item.get("itemWebUrl"),
                    "image_url": item.get("image", {}).get("imageUrl")
                })
            print(f"✓ Found {len(ebay_results)} eBay results")
        else:
            print(f"⚠️  eBay search returned no results or error: {ebay_data}")
            ebay_results = []
        
        # --- Parse Amazon (Rainforest) Results ---
        amazon_results = []
        if amazon_data and "search_results" in amazon_data:
            for item in amazon_data["search_results"][:4]:
                amazon_results.append({
                    "title": item.get("title"),
                    "price": item.get("price", {}).get("raw"),
                    "rating": f"{item.get('rating')} stars ({item.get('ratings_total')} reviews)",
                    "url": item.get("link"),
                    "image_url": item.get("image")
                })

        return ChatResponse(
            type="results",
            message=f"Great! I will search both eBay and Amazon for: '{final_query}'",
            history=chat_history,
            results={"ebay": ebay_results, "amazon": amazon_results}
        )
        
    else:
        # --- B. It's a Follow-up Question ---
        return ChatResponse(
            type="question",
            message=ai_message,
            history=chat_history
        )

# --- VISION AND VOICE ENDPOINT (OpenClaw Style) ---
@app.post("/vision-chat", response_model=ChatResponse)
async def handle_vision_chat(request: VisionChatRequest):
    print(f"👁️ Vision Request Received: '{request.voice_text}'")
    
    # 1. System Prompt matching OpenClaw's persona + our search logic
    system_prompt = (
        "You are an embodied AI assistant integrated into a pair of smart glasses. "
        "You can see what the user sees through their camera and hear what they say. "
        "Your role is to understand their voice request in the context of the image provided. "
        "If they ask to buy, identify, or find the object they are pointing at or looking at, "
        "you must analyze the image, figure out exactly what the object is, and ask 1-2 follow-up questions "
        "to refine a product search (like model, size, color). "
        "Once you have enough details, your *very last* message must ONLY be the "
        "final search query, prefixed with 'FINAL_QUERY:'. "
        "For example: 'FINAL_QUERY: Apple Watch Series 9 Midnight 45mm new'."
    )
    
    # 2. Build Multimodal Content for OpenRouter / Gemini
    # Note: OpenRouter supports multimodal image inputs using OpenAI format.
    try:
        response = ai_client.chat.completions.create(
            model="google/gemini-2.5-flash-lite", 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": [
                    {
                        "type": "text",
                        "text": f"User's Voice Command: {request.voice_text}"
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{request.image_base64}"
                        }
                    }
                ]}
            ]
        )
        ai_message = response.choices[0].message.content.strip()
    except Exception as e:
        print(f"✗ Error communicating with multimodal AI: {e}")
        return ChatResponse(type="error", message="Failed to process image and voice.", history=[])
        
    # 3. Handle the response (similar to text chat)
    if ai_message.startswith("FINAL_QUERY:"):
        final_query = ai_message.replace("FINAL_QUERY:", "").strip()
        print(f"🔎 Vision Agent Initiating Search for: {final_query}")
        
        ebay_data = ebay.search_items(final_query, limit=4)
        amazon_data = amazon.search_items(final_query)
        
        ebay_results = []
        if ebay_data and "itemSummaries" in ebay_data:
            for item in ebay_data["itemSummaries"][:4]:
                ebay_results.append({
                    "title": item.get("title"),
                    "price": f"{item.get('price', {}).get('value')} {item.get('price', {}).get('currency')}",
                    "url": item.get("itemWebUrl"),
                    "image_url": item.get("image", {}).get("imageUrl")
                })
                
        amazon_results = []
        if amazon_data and "search_results" in amazon_data:
            for item in amazon_data["search_results"][:4]:
                amazon_results.append({
                    "title": item.get("title"),
                    "price": item.get("price", {}).get("raw"),
                    "url": item.get("link"),
                    "image_url": item.get("image")
                })

        return ChatResponse(
            type="results",
            message=f"I've found information about the '{final_query}' you are looking at.",
            history=[],
            results={"ebay": ebay_results, "amazon": amazon_results}
        )
    else:
        # It's a follow-up question based on the image
        return ChatResponse(
            type="question",
            message=ai_message,
            history=[]
        )

if __name__ == "__main__":
    
    print("Starting backend API server at http://127.0.0.1:8000")
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)