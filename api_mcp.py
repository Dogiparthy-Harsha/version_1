#!/usr/bin/env python3
"""
Backend API Server (FastAPI) - HTTP-based MCP Architecture
Connects to HTTP MCP servers for research, eBay, and Amazon
Includes User Authentication and SQLite Persistence
"""

import os
import uvicorn
import httpx
from datetime import datetime, timedelta

from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from openai import OpenAI
from sqlalchemy.orm import Session

# Load API Keys
from dotenv import load_dotenv
load_dotenv()

# Import Auth & DB
import models
import auth
from database import engine, get_db
from embeddings import EmbeddingService

# Create Tables
models.Base.metadata.create_all(bind=engine)

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

# Initialize RAG Embedding Service
print("Initializing RAG Embedding Service...")
try:
    embedding_service = EmbeddingService()
    print("✓ RAG Embedding Service ready")
except Exception as e:
    print(f"⚠️  RAG Embedding Service failed to initialize: {e}")
    embedding_service = None



# --- Request/Response Models ---

class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None
    history: List[Dict[str, Any]]
    image_data: Optional[str] = None  # Base64-encoded image

class ChatResponse(BaseModel):
    type: str
    message: str
    conversation_id: int
    history: List[Dict[str, Any]]
    results: Optional[Dict] = None
    image_data: Optional[str] = None  # Echo back image if sent

class ConversationResponse(BaseModel):
    id: int
    title: str
    created_at: datetime

# --- Auth Endpoints ---

@app.post("/register", response_model=Token)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Validate password strength
    auth.validate_password_strength(user.password)
    
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}


# --- Conversation Endpoints ---

@app.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    conversations = db.query(models.Conversation).filter(
        models.Conversation.user_id == current_user.id
    ).order_by(models.Conversation.created_at.desc()).all()
    return conversations

@app.get("/conversations/{conversation_id}", response_model=List[Dict])
def get_conversation_history(
    conversation_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    conversation = db.query(models.Conversation).filter(
        models.Conversation.id == conversation_id,
        models.Conversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    messages = db.query(models.Chat).filter(
        models.Chat.conversation_id == conversation_id
    ).order_by(models.Chat.timestamp.asc()).all()
    
    # Include results and image_data if they exist
    return [
        {
            "role": msg.role, 
            "content": msg.message,
            "results": msg.results if msg.results else None,
            "image_data": msg.image_data if msg.image_data else None
        } 
        for msg in messages
    ]

@app.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    conversation = db.query(models.Conversation).filter(
        models.Conversation.id == conversation_id,
        models.Conversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    db.delete(conversation)
    db.commit()
    return {"message": "Conversation deleted"}


# --- Chat Endpoint (Protected) ---

@app.post("/chat", response_model=ChatResponse)
async def handle_chat(
    request: ChatRequest, 
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Handle Conversation ID
    conversation_id = request.conversation_id
    
    if conversation_id:
        # Verify ownership
        conversation = db.query(models.Conversation).filter(
            models.Conversation.id == conversation_id,
            models.Conversation.user_id == current_user.id
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        # Create new conversation
        # Use first few words of message as title, or "New Chat"
        title = "New Chat"
        if request.message:
            title = (request.message[:30] + '..') if len(request.message) > 30 else request.message
            
        conversation = models.Conversation(user_id=current_user.id, title=title)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        conversation_id = conversation.id

    # Save User Message to DB
    if request.message or request.image_data:
        user_msg = models.Chat(
            conversation_id=conversation_id, 
            message=request.message or "", 
            role="user",
            image_data=request.image_data
        )
        db.add(user_msg)
        db.commit()
        
        # NOTE: We'll store in Pinecone AFTER getting AI response
        # to avoid retrieving the current message as "past history"

    # Retrieve RAG context from user's past conversations
    rag_context = ""
    if embedding_service and request.message:
        try:
            rag_context = embedding_service.get_user_context(
                user_id=current_user.id,
                query=request.message,
                top_k=3
            )
            if rag_context:
                print(f"📚 RAG Context retrieved:\n{rag_context}")
        except Exception as e:
            print(f"⚠️  Failed to retrieve RAG context: {e}")

    # System prompt
    current_date = datetime.now().strftime("%B %d, %Y")
    system_prompt = (
        f"You are a helpful search assistant for eBay and Amazon. Today's date is {current_date}. "
        "Your goal is to ask the user 1-2 follow-up questions to get key details "
        "(like model, color, size, condition, storage, or budget) to refine their search. "
        "Once you have enough details, your *very last* message must ONLY be the "
        "final search query, prefixed with 'FINAL_QUERY:'. "
        "For the FINAL_QUERY, include the product model and storage/size, but you may include color and condition. "
        "For example: 'FINAL_QUERY: iPhone 15 Pro Max 256GB blue new' or 'FINAL_QUERY: Samsung S24 Ultra 512GB'. "
        "IMPORTANT: Your training data regarding product release dates may be outdated. "
        "Do NOT refuse to search for a product just because you think it is unreleased. "
        "Instead, gather the necessary details and generate the 'FINAL_QUERY' so that our "
        "real-time verification agent can check its actual availability. "
        "Let the verification tool be the judge of whether a product exists. "
        "If the user provides an image, analyze it to identify the item "
        "(brand, model, color, condition, material, style). Combine visual details with "
        "the user's text message to generate the most accurate search query. "
        "Describe what you see in the image before asking follow-up questions."
    )
    
    # Enhance system prompt with RAG context if available
    if rag_context:
        system_prompt = (
            f"{system_prompt}\n\n"
            f"=== YOUR MEMORY OF THIS USER ===\n"
            f"{rag_context}\n"
            f"=== END OF MEMORY ===\n\n"
            f"IMPORTANT: The above is YOUR memory of this user's past searches and preferences. "
            f"ONLY reference this memory when it is DIRECTLY relevant to what the user is "
            f"currently asking about. Do NOT bring up unrelated past searches. "
            f"For example, if they are searching for a bag, do NOT mention their past phone searches. "
            f"Only mention past history if it helps refine the CURRENT search "
            f"(e.g., 'Last time you looked for a similar bag in black, want the same color?')."
        )
    
    welcome_message = f"Greetings {current_user.username}, I will help you find the best deals on eBay and Amazon. What are you looking for today?"
    
    # Handle initial welcome (only for new empty chats)
    if not request.message and not request.history:
        # If it's a new conversation, save the welcome message
        ai_msg_db = models.Chat(
            conversation_id=conversation_id, 
            message=welcome_message, 
            role="assistant"
        )
        db.add(ai_msg_db)
        db.commit()
        
        print("INFO: Sending initial welcome message")
        return ChatResponse(
            type="question",
            message=welcome_message,
            conversation_id=conversation_id,
            history=[
                {"role": "system", "content": system_prompt},
                {"role": "assistant", "content": welcome_message}
            ]
        )

    # Prepare chat history
    chat_history = request.history
    
    # Build the user message content — multimodal if image is present
    if request.image_data:
        # Multimodal message: list of content parts (text + image)
        user_content = []
        if request.message:
            user_content.append({"type": "text", "text": request.message})
        user_content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{request.image_data}"
            }
        })
        chat_history.append({"role": "user", "content": user_content})
    else:
        chat_history.append({"role": "user", "content": request.message})
    
    # Prepend system prompt to ensure AI always knows the context and date
    messages_for_ai = [{"role": "system", "content": system_prompt}] + chat_history
    
    # Call AI
    try:
        response = ai_client.chat.completions.create(
            model="google/gemini-2.5-flash-lite",
            messages=messages_for_ai
        )
        ai_message = response.choices[0].message.content.strip()
        print(f"🤖 AI Raw Response: {ai_message}") # DEBUG PRINT
        
    except Exception as e:
        print(f"✗ Error communicating with OpenRouter: {e}")
        return ChatResponse(
            type="question",
            message="Sorry, I had an error connecting to the AI. Please try again.",
            conversation_id=conversation_id,
            history=chat_history
        )

    # Check if it's a final query
    if "FINAL_QUERY:" in ai_message: # More lenient check
        # Extract query even if there's surrounding text (though prompt says ONLY)
        parts = ai_message.split("FINAL_QUERY:")
        final_query = parts[-1].strip()
        
        # Extract base product name for verification (remove color/condition modifiers)
        # This helps avoid false negatives when users specify colors that don't match official names
        import re
        verification_query = final_query
        # Remove common color words and condition words for verification
        color_condition_words = r'\b(black|white|blue|red|green|yellow|orange|purple|pink|gray|grey|silver|gold|rose|titanium|new|used|refurbished|unlocked|sealed)\b'
        verification_query = re.sub(color_condition_words, '', final_query, flags=re.IGNORECASE).strip()
        # Clean up extra spaces
        verification_query = ' '.join(verification_query.split())
        
        # --- Call Research Agent (HTTP) ---
        print(f"🔍 Research Agent (HTTP): Verifying '{verification_query}'...")
        try:
            research_response = await http_client.post(
                f"{RESEARCH_AGENT_URL}/verify_product",
                json={"product_name": verification_query}
            )
            verification = research_response.json()
            
            # DEBUG: Print full verification output
            import json
            print(f"📋 Research Agent Output:\n{json.dumps(verification, indent=2)}")
            
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
                
                # Save this user-friendly message to DB instead of FINAL_QUERY
                chat_history.append({"role": "assistant", "content": message})
                ai_msg_db = models.Chat(
                    conversation_id=conversation_id, 
                    message=message, 
                    role="assistant"
                )
                db.add(ai_msg_db)
                db.commit()
                
                return ChatResponse(
                    type="question",
                    message=message,
                    conversation_id=conversation_id,
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

        # Create user-friendly message for results
        results_message = f"Great! I searched both eBay and Amazon for: '{final_query}'"
        results_data = {"ebay": ebay_results, "amazon": amazon_results}
        
        # Save this message AND results to DB
        chat_history.append({"role": "assistant", "content": results_message})
        ai_msg_db = models.Chat(
            conversation_id=conversation_id, 
            message=results_message, 
            role="assistant",
            results=results_data  # Save results as JSON
        )
        db.add(ai_msg_db)
        db.commit()
        
        # Store AI response in Pinecone for RAG
        if embedding_service:
            try:
                embedding_service.store_message(
                    user_id=current_user.id,
                    conversation_id=conversation_id,
                    message=results_message,
                    role="assistant",
                    metadata={"product_query": final_query}
                )
            except Exception as e:
                print(f"⚠️  Failed to store AI response in Pinecone: {e}")
        
        # NOW store the user's message in Pinecone (after AI response)
        if embedding_service and request.message:
            try:
                embedding_service.store_message(
                    user_id=current_user.id,
                    conversation_id=conversation_id,
                    message=request.message,
                    role="user"
                )
            except Exception as e:
                print(f"⚠️  Failed to store user message in Pinecone: {e}")

        return ChatResponse(
            type="results",
            message=results_message,
            conversation_id=conversation_id,
            history=chat_history,
            results=results_data
        )
        
    else:
        # Just a clarifying question (no FINAL_QUERY yet)
        chat_history.append({"role": "assistant", "content": ai_message})
        
        # Save AI response to DB
        ai_msg_db = models.Chat(
            conversation_id=conversation_id, 
            message=ai_message, 
            role="assistant"
        )
        db.add(ai_msg_db)
        db.commit()
        
        # Store AI response in Pinecone for RAG
        if embedding_service:
            try:
                embedding_service.store_message(
                    user_id=current_user.id,
                    conversation_id=conversation_id,
                    message=ai_message,
                    role="assistant"
                )
            except Exception as e:
                print(f"⚠️  Failed to store AI response in Pinecone: {e}")
        
        # NOW store the user's message in Pinecone (after AI response)
        # This prevents the current message from appearing as "past history"
        if embedding_service and request.message:
            try:
                embedding_service.store_message(
                    user_id=current_user.id,
                    conversation_id=conversation_id,
                    message=request.message,
                    role="user"
                )
            except Exception as e:
                print(f"⚠️  Failed to store user message in Pinecone: {e}")
        
        return ChatResponse(
            type="question",
            message=ai_message,
            conversation_id=conversation_id,
            history=chat_history
        )

# --- Virtual Try-On Endpoint ---
from fastapi import UploadFile, File, Depends, Response
import time
@app.post("/virtual-try-on")
async def virtual_try_on(
    clothing_image: UploadFile = File(...),
    avatar_image: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Real Virtual Try-On integration with Nano Banana API.
    Forwards user images to the AI service and returns the result.
    """
    print(f"🍌 Virtual Try-On Request from {current_user.username}")
    
    # 1. Configuration - Get these from your .env file or AI Studio dashboard
    NANO_BANANA_API_URL = os.getenv("NANO_BANANA_API_URL", "YOUR_ACTUAL_API_ENDPOINT_HERE")
    NANO_BANANA_API_KEY = os.getenv("NANO_BANANA_API_KEY")

    if not NANO_BANANA_API_URL or "YOUR_ACTUAL" in NANO_BANANA_API_URL:
        print("❌ Error: Nano Banana API URL not configured")
        raise HTTPException(status_code=500, detail="Server misconfiguration: Missing API URL")

    try:
        # 2. Read file contents into memory
        clothing_bytes = await clothing_image.read()
        avatar_bytes = await avatar_image.read()

        # 3. Prepare the request to your AI Studio API
        # We use a timeout of 60s because image generation can be slow
        async with httpx.AsyncClient(timeout=60.0) as client:
            print("🚀 Sending images to Nano Banana API...")
            
            # Construct Multipart Form Data
            # Adjust field names ('clothing', 'avatar') if your API expects specific names
            files = {
                'clothing_image': (clothing_image.filename, clothing_bytes, clothing_image.content_type),
                'avatar_image': (avatar_image.filename, avatar_bytes, avatar_image.content_type)
            }
            
            headers = {}
            if NANO_BANANA_API_KEY:
                headers["Authorization"] = f"Bearer {NANO_BANANA_API_KEY}"
                # Or if it uses x-api-key:
                # headers["x-api-key"] = NANO_BANANA_API_KEY

            # 4. Make the call
            response = await client.post(
                NANO_BANANA_API_URL,
                files=files,
                headers=headers
            )

            # 5. Check response
            if response.status_code != 200:
                print(f"❌ AI API Error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=502, 
                    detail=f"AI Processing Failed: {response.text[:100]}"
                )

            print("✅ Received result from AI")
            
            # 6. Return the generated image bytes directly
            return Response(content=response.content, media_type="image/png")

    except httpx.RequestError as e:
        print(f"❌ Connection Error: {e}")
        raise HTTPException(status_code=503, detail="AI Service Unavailable")
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during processing")

if __name__ == "__main__":
    print("Starting Main API Server (HTTP-based MCP) at http://0.0.0.0:8000")
    uvicorn.run("api_mcp:app", host="0.0.0.0", port=8000, reload=True)
