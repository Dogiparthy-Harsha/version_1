import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import './App.css'

const API_URL = 'http://127.0.0.1:8000'

// Create a wrapper component to use the auth hook
const ChatApp = () => {
  const { user, token, logout, loading } = useAuth();
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [conversations, setConversations] = useState([])
  const [currentConversationId, setCurrentConversationId] = useState(null)
  const messagesEndRef = useRef(null)

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Clear all state when user logs out
  useEffect(() => {
    if (!user) {
      setMessages([]);
      setResults(null);
      setConversations([]);
      setCurrentConversationId(null);
    }
  }, [user]);

  // Fetch conversations on mount
  useEffect(() => {
    if (!user) return;
    fetchConversations();
  }, [user, token]);

  const fetchConversations = async () => {
    try {
      const response = await axios.get(`${API_URL}/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  // Load conversation history when selected
  useEffect(() => {
    if (!currentConversationId) {
      setMessages([]);
      setResults(null); // Clear results for new chat
      return;
    }

    const loadConversation = async () => {
      try {
        const response = await axios.get(`${API_URL}/conversations/${currentConversationId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const loadedMessages = response.data;
        setMessages(loadedMessages);

        // Check if any message has results and restore them
        const messageWithResults = loadedMessages.find(msg => msg.results);
        if (messageWithResults) {
          setResults(messageWithResults.results);
        } else {
          setResults(null);
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
      }
    };

    loadConversation();
  }, [currentConversationId, token]);

  const handleNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setResults(null);
  };

  const handleDeleteConversation = async (id) => {
    try {
      await axios.delete(`${API_URL}/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchConversations();
      if (currentConversationId === id) {
        handleNewChat();
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    // Add user message to chat immediately
    const newMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)

    try {
      // Prepare history for API (exclude system messages if we were doing that on frontend, but we aren't)
      const history = newMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const response = await axios.post(
        `${API_URL}/chat`,
        {
          message: userMessage,
          conversation_id: currentConversationId,
          history: history.slice(0, -1) // Exclude the message we just added
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Add assistant response
      setMessages([...newMessages, {
        role: 'assistant',
        content: response.data.message
      }])

      // Update conversation ID if it was a new chat
      if (!currentConversationId && response.data.conversation_id) {
        setCurrentConversationId(response.data.conversation_id);
        fetchConversations(); // Refresh list to show new title
      }

      // If we got results, display them
      if (response.data.type === 'results' && response.data.results) {
        setResults(response.data.results)
      }

    } catch (error) {
      console.error('Error sending message:', error)
      if (error.response?.status === 401) {
        logout();
      } else {
        setMessages([...newMessages, {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.'
        }])
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) return <div className="app">Loading...</div>;
  if (!user) return <Login />;

  return (
    <div className="app">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>🛍️ AI Shopping Assistant</h1>
          <p>Find the best deals on eBay and Amazon</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ marginRight: '1rem', color: 'var(--text-secondary)' }}>Hi, {user.username}</span>
          <button
            onClick={logout}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '0.5rem 1rem',
              color: 'white',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <div className="container">
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={setCurrentConversationId}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
        />

        {/* Chat Section */}
        <div className="chat-section">
          <div className="chat-container">
            <div className="messages">
              {messages.length === 0 && !currentConversationId && (
                <div className="message assistant">
                  <div className="message-content">
                    <p>👋 Hi! I can help you find products on eBay and Amazon. What are you looking for?</p>
                  </div>
                </div>
              )}
              {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.role}`}>
                  <div className="message-content">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="message assistant">
                  <div className="message-content loading">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="input-form">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                disabled={isLoading}
                className="message-input"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="send-button"
              >
                Send
              </button>
            </form>
          </div>
        </div>

        {/* Results Section */}
        {results && (
          <div className="results-section">
            <h2>Search Results</h2>

            {/* eBay Results */}
            {results.ebay && results.ebay.length > 0 && (
              <div className="marketplace-results">
                <h3>eBay</h3>
                <div className="products-grid">
                  {results.ebay.map((product, index) => (
                    <div key={index} className="product-card">
                      {product.image_url && (
                        <img src={product.image_url} alt={product.title} />
                      )}
                      <h4>{product.title}</h4>
                      <p className="price">{product.price}</p>
                      {product.condition && (
                        <p className="condition">{product.condition}</p>
                      )}
                      <a
                        href={product.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="view-button"
                      >
                        View on eBay
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amazon Results */}
            {results.amazon && results.amazon.length > 0 && (
              <div className="marketplace-results">
                <h3>Amazon</h3>
                <div className="products-grid">
                  {results.amazon.map((product, index) => (
                    <div key={index} className="product-card">
                      {product.image_url && (
                        <img src={product.image_url} alt={product.title} />
                      )}
                      <h4>{product.title}</h4>
                      <p className="price">{product.price}</p>
                      {product.rating && (
                        <p className="rating">{product.rating}</p>
                      )}
                      <a
                        href={product.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="view-button"
                      >
                        View on Amazon
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ChatApp />
    </AuthProvider>
  )
}

export default App
