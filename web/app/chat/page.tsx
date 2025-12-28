'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Settings, LogOut, MoreVertical, Trash2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser } from '@/context/user-context';
import { useRouter } from 'next/navigation';
import { conversationsApi, messagesApi, chatApi } from '@/lib/api';

// Types
interface Message {
  id: number;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface Conversation {
  id: number;
  title: string;
  created_at: string;
}

export default function ChatApp() {
  const router = useRouter();
  const { user, isLoading: userLoading, isAuthenticated, logout } = useUser();

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!userLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [userLoading, isAuthenticated, router]);

  // Load conversations when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversations from backend
  async function loadConversations() {
    try {
      const data = await conversationsApi.getAll();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }

  // Load messages for a conversation
  async function loadMessages(conversationId: number) {
    try {
      const data = await messagesApi.getByConversation(conversationId);
      setMessages(
        (data.messages || []).map((m: { id: number; content: string; sender: string; timestamp: string }) => ({
          id: m.id,
          content: m.content,
          sender: m.sender as 'user' | 'ai',
          timestamp: new Date(m.timestamp),
        }))
      );
      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  // Start new chat
  function handleNewChat() {
    setMessages([]);
    setCurrentConversationId(null);
  }

  const deletingIds = useRef<Set<number>>(new Set());

  // Delete conversation
  async function handleDeleteConversation(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (deletingIds.current.has(id)) return;

    // 1. Optimistic Update: Remove from UI immediately
    const previousConversations = [...conversations];
    setConversations(prev => prev.filter(c => c.id !== id));
    deletingIds.current.add(id);

    try {
      await conversationsApi.delete(id);

      if (currentConversationId === id) {
        setMessages([]);
        setCurrentConversationId(null);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      // Rollback on error
      setConversations(previousConversations);
      alert("Failed to delete conversation. It might have already been removed.");
    } finally {
      deletingIds.current.delete(id);
    }
  }

  // Send message to backend
  async function handleSendMessage() {
    if (!input.trim() || loading) return;

    const text = input;
    setInput('');
    setLoading(true);

    // 1. Optimistically show user message
    const tempUserId = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, content: text, sender: 'user', timestamp: new Date() }
    ]);

    try {
      const response = await chatApi.streamChat(text, currentConversationId || undefined);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let aiMessageId: number | null = null;
      let accumulatedContent = "";

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);

            if (data.type === 'meta') {
              // Sync user message ID and conversation ID
              if (!currentConversationId && data.conversation_id) {
                setCurrentConversationId(data.conversation_id);
                loadConversations();
              }
              setMessages(prev => prev.map(m =>
                m.id === tempUserId ? { ...m, id: data.user_message.id } : m
              ));
            }

            else if (data.type === 'content') {
              accumulatedContent += data.content;

              setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.sender === 'ai' && lastMsg.id === aiMessageId) {
                  // Update existing streaming message
                  return [...prev.slice(0, -1), { ...lastMsg, content: accumulatedContent }];
                } else {
                  // Start new AI message
                  aiMessageId = -1; // Temporary ID for streaming
                  return [...prev, { id: aiMessageId, content: accumulatedContent, sender: 'ai', timestamp: new Date() }];
                }
              });
            }

            else if (data.type === 'done') {
              // Final sync of the AI message
              setMessages(prev => prev.map(m =>
                (m.sender === 'ai' && m.id === -1) ? {
                  ...m,
                  id: data.ai_message.id,
                  content: data.ai_message.content,
                  timestamp: new Date(data.ai_message.timestamp)
                } : m
              ));
            }

            else if (data.type === 'error') {
              throw new Error(data.content);
            }
          } catch (e) {
            console.error("Error parsing stream chunk:", e);
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
      setInput(text);
      alert(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setLoading(false);
    }
  }

  // Loading state
  if (userLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col bg-muted/30">
        <div className="p-4 border-b border-border">
          <Button className="w-full" onClick={handleNewChat}>
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Conversations
          </div>
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No conversations yet</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => loadMessages(conv.id)}
                className={`group px-3 py-2 rounded-lg text-sm cursor-pointer flex items-center justify-between ${currentConversationId === conv.id ? 'bg-secondary' : 'hover:bg-secondary/50'
                  }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  <span className="truncate">{conv.title}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border space-y-2">
          {user && (
            <div className="flex items-center gap-2 px-2 py-2">
              {user.picture && <img src={user.picture} alt="" className="w-8 h-8 rounded-full" />}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.name || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          )}
          <Button variant="ghost" className="w-full justify-start">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button variant="ghost" className="w-full justify-start text-destructive" onClick={() => logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-border bg-muted/50 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Chat</h1>
            <p className="text-sm text-muted-foreground">
              {user ? `Welcome, ${user.name || user.email}` : ''}
            </p>
          </div>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <h2 className="text-xl font-semibold mb-2">Start a conversation</h2>
                <p className="text-muted-foreground">Type a message below</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-md px-4 py-3 rounded-2xl ${msg.sender === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-secondary rounded-bl-sm'
                    }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-xs opacity-60 mt-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
          {loading && messages[messages.length - 1]?.sender !== 'ai' && (
            <div className="flex justify-start">
              <div className="bg-secondary px-4 py-3 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border bg-muted/50 px-8 py-4">
          <div className="flex gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSendMessage())}
              placeholder="Type your message..."
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={loading || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}