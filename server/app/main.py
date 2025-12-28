from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import StreamingResponse
import json
from pydantic import BaseModel
from typing import Optional, List
from .config import client_id, client_secret, secret_key, OLLAMA_BASE_URL, OLLAMA_MODEL
import httpx
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import Request
from starlette.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from fastapi.middleware.cors import CORSMiddleware
from .models import Base, User, Message, Conversation
from .database import engine, get_db


# Pydantic models for request/response
class ConversationCreate(BaseModel):
    title: Optional[str] = "New Chat"

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None


app = FastAPI()
Base.metadata.create_all(bind=engine)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SessionMiddleware, secret_key=secret_key)
oauth = OAuth()
oauth.register(
    name='google',
    client_id=client_id,
    client_secret=client_secret,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        "scope": "openid email profile"
    },
)


# Helper function to get current user from session
def get_current_user_from_session(request: Request, db):
    user_data = request.session.get('user')
    if not user_data:
        return None
    db_user = db.query(User).filter(User.google_id == user_data['sub']).first()
    return db_user


@app.get("/")
async def read_root():
    return {"Hello": "World"}


@app.get("/login")
async def login(request: Request):
    redirect_uri = "http://localhost:8000/auth"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@app.get("/auth")
async def auth(request: Request, db = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    user = await oauth.google.userinfo(token=token)
    if user:
        existing_user = db.query(User).filter(User.google_id == user['sub']).first()
        if not existing_user:
            new_user = User(
                google_id=user['sub'],
                email=user['email'],
                name=user.get('name'),
                picture=user.get('picture')
            )
            db.add(new_user)
            db.commit()
        request.session['user'] = dict(user)
        return RedirectResponse(url="http://localhost:3000/chat")
    return {"error": "Authentication failed"}


@app.post("/auth/logout")
async def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out successfully"}


@app.get("/me")
async def get_current_user(request: Request, db = Depends(get_db)):
    user_data = request.session.get('user')
    if user_data:
        db_user = db.query(User).filter(User.google_id == user_data['sub']).first()
        if db_user:
            return {
                "user": {
                    "id": str(db_user.id),
                    "email": db_user.email,
                    "name": db_user.name,
                    "picture": db_user.picture
                }
            }
    return {"user": None}


# ==================== CONVERSATIONS ====================

@app.get("/api/conversations")
async def get_conversations(request: Request, db = Depends(get_db)):
    """Get all conversations for the current user"""
    db_user = get_current_user_from_session(request, db)
    if not db_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    conversations = db.query(Conversation).filter(
        Conversation.user_id == db_user.id
    ).order_by(Conversation.created_at.desc()).all()
    
    return {
        "conversations": [
            {
                "id": conv.id,
                "title": conv.title,
                "created_at": conv.created_at.isoformat()
            }
            for conv in conversations
        ]
    }


@app.post("/api/conversations")
async def create_conversation(
    conversation: ConversationCreate,
    request: Request,
    db = Depends(get_db)
):
    """Create a new conversation"""
    db_user = get_current_user_from_session(request, db)
    if not db_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    new_conversation = Conversation(
        user_id=db_user.id,
        title=conversation.title
    )
    db.add(new_conversation)
    db.commit()
    db.refresh(new_conversation)
    
    return {
        "id": new_conversation.id,
        "title": new_conversation.title,
        "created_at": new_conversation.created_at.isoformat()
    }


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    request: Request,
    db = Depends(get_db)
):
    """Delete a conversation (messages are deleted automatically via cascade)"""
    db_user = get_current_user_from_session(request, db)
    if not db_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == db_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    db.delete(conversation)
    db.commit()
    
    return {"message": "Conversation deleted"}


# ==================== MESSAGES ====================

@app.get("/api/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: int,
    request: Request,
    db = Depends(get_db)
):
    """Get all messages for a conversation"""
    db_user = get_current_user_from_session(request, db)
    if not db_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == db_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.timestamp.asc()).all()
    
    return {
        "messages": [
            {
                "id": msg.id,
                "content": msg.content,
                "sender": msg.sender,
                "timestamp": msg.timestamp.isoformat()
            }
            for msg in messages
        ]
    }


# ==================== CHAT ====================

@app.post("/api/chat")
async def chat(
    chat_request: ChatRequest,
    request: Request,
    db = Depends(get_db)
):
    """Stream AI response to the user"""
    db_user = get_current_user_from_session(request, db)
    if not db_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    conversation_id = chat_request.conversation_id
    
    # Create or verify conversation
    if not conversation_id:
        title = chat_request.message[:50] + "..." if len(chat_request.message) > 50 else chat_request.message
        new_conversation = Conversation(user_id=db_user.id, title=title)
        db.add(new_conversation)
        db.commit()
        db.refresh(new_conversation)
        conversation_id = new_conversation.id
    else:
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == db_user.id
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Save user message
    user_message = Message(
        conversation_id=conversation_id,
        sender="user",
        content=chat_request.message
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    async def event_generator():
        # 1. Send initial metadata
        yield json.dumps({
            "type": "meta",
            "conversation_id": conversation_id,
            "user_message": {
                "id": user_message.id,
                "content": user_message.content,
                "timestamp": user_message.timestamp.isoformat()
            }
        }) + "\n"

        # 2. Get history for context (fetch last 10, then reverse to chronological order)
        history = db.query(Message).filter(
            Message.conversation_id == conversation_id
        ).order_by(Message.timestamp.desc()).limit(10).all()
        history.reverse() # Back to chronological
        
        ollama_messages = [{"role": "user" if m.sender == "user" else "assistant", "content": m.content} for m in history]

        full_response = ""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    f"{OLLAMA_BASE_URL}/api/chat",
                    json={
                        "model": OLLAMA_MODEL,
                        "messages": ollama_messages,
                        "stream": True
                    }
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line: continue
                        chunk = json.loads(line)
                        if "message" in chunk and "content" in chunk["message"]:
                            content = chunk["message"]["content"]
                            full_response += content
                            yield json.dumps({"type": "content", "content": content}) + "\n"
                        if chunk.get("done"):
                            break
        except Exception as e:
            error_msg = f"Ollama Connection Error: {str(e)}"
            yield json.dumps({"type": "error", "content": error_msg}) + "\n"
            full_response = error_msg

        # 3. Save full AI response to DB
        ai_message = Message(
            conversation_id=conversation_id,
            sender="ai",
            content=full_response
        )
        db.add(ai_message)
        db.commit()
        db.refresh(ai_message)
        
        yield json.dumps({
            "type": "done",
            "ai_message": {
                "id": ai_message.id,
                "content": ai_message.content,
                "timestamp": ai_message.timestamp.isoformat()
            }
        }) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")