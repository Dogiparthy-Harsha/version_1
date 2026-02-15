import { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import VirtualTryOn from './components/VirtualTryOn'
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
  const [selectedImage, setSelectedImage] = useState(null)   // File object
  const [imagePreview, setImagePreview] = useState(null)      // data URL for preview
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const recognitionRef = useRef(null)

  // Voice input
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const speechSupported = !!SpeechRecognition

  const toggleVoiceInput = useCallback(() => {
    if (!speechSupported) return;

    // STOP if already listening
    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { }
        recognitionRef.current = null;
      }
      setIsListening(false);
      return;
    }

    // START listening
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';

      // CRITICAL FIX: continuous=true prevents immediate cutoff
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        let hasFinal = false;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
            hasFinal = true;
          } else {
            interim += transcript;
          }
        }

        // Update input state safely
        if (final || interim) {
          setInput(prev => {
            const currentVal = prev || '';
            // Only append finalized text to avoid duplication issues
            if (hasFinal) return currentVal + (currentVal ? ' ' : '') + final;
            return currentVal;
          });
        }

        // CRITICAL FIX: Manually stop as soon as user finishes a sentence
        if (hasFinal) {
          recognition.stop();
          setIsListening(false);
          recognitionRef.current = null;
        }
      };

      recognition.onend = () => {
        // No auto-restart here
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
          setIsListening(false);
          recognitionRef.current = null;
        }
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      setIsListening(false);
    }
  }, [isListening, speechSupported])

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
    // Add welcome message that persists
    setMessages([{
      role: 'assistant',
      content: '👋 Hi! I can help you find products on eBay and Amazon. What are you looking for?'
    }]);
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

  // Handle image file selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setSelectedImage(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)  // full data URL for preview
    }
    reader.readAsDataURL(file)
  }

  const removeSelectedImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if ((!input.trim() && !selectedImage) || isLoading) return

    const userMessage = input.trim()
    const currentImagePreview = imagePreview          // capture before clearing
    const currentImageBase64 = imagePreview
      ? imagePreview.split(',')[1]                    // strip data:...;base64, prefix
      : null
    setInput('')
    removeSelectedImage()
    setIsLoading(true)

    // Add user message to chat immediately (with image if present)
    const userMsgObj = { role: 'user', content: userMessage }
    if (currentImagePreview) {
      userMsgObj.image_data = currentImageBase64
    }
    const newMessages = [...messages, userMsgObj]
    setMessages(newMessages)

    try {
      // Prepare history for API
      const history = newMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const payload = {
        message: userMessage,
        conversation_id: currentConversationId,
        history: history.slice(0, -1) // Exclude the message we just added
      }
      if (currentImageBase64) {
        payload.image_data = currentImageBase64
      }

      const response = await axios.post(
        `${API_URL}/chat`,
        payload,
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

  const [chatZoom, setChatZoom] = useState(1)
  const [resultsZoom, setResultsZoom] = useState(1)
  const chatRef = useRef(null)
  const resultsRef = useRef(null)

  // Handle pinch-to-zoom (wheel + ctrlKey)
  useEffect(() => {
    const handleZoom = (e, setZoom) => {
      // ctrlKey + wheel is the standard for pinch gestures on trackpads
      if (e.ctrlKey) {
        e.preventDefault()
        setZoom(prev => {
          const newZoom = prev - e.deltaY * 0.01
          return Math.min(Math.max(newZoom, 0.5), 2.5) // Limit zoom between 0.5x and 2.5x
        })
      }
    }

    const chatEl = chatRef.current
    const resultsEl = resultsRef.current

    const chatHandler = (e) => handleZoom(e, setChatZoom)
    const resultsHandler = (e) => handleZoom(e, setResultsZoom)

    if (chatEl) chatEl.addEventListener('wheel', chatHandler, { passive: false })
    if (resultsEl) resultsEl.addEventListener('wheel', resultsHandler, { passive: false })

    return () => {
      if (chatEl) chatEl.removeEventListener('wheel', chatHandler)
      if (resultsEl) resultsEl.removeEventListener('wheel', resultsHandler)
    }
  }, [results]) // Re-attach when results appear

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

        {/* Main Content Area */}
        <div className="main-content">
          {/* Chat Section */}
          <div className="chat-section" ref={chatRef}>
            <div className="chat-container" style={{ zoom: chatZoom }}>
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
                      {msg.image_data && (
                        <img
                          src={`data:image/jpeg;base64,${msg.image_data}`}
                          alt="Uploaded"
                          className="message-image"
                        />
                      )}
                      {msg.content && <ReactMarkdown>{msg.content}</ReactMarkdown>}
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

              {/* Image preview strip */}
              {imagePreview && (
                <div className="image-preview-container">
                  <img src={imagePreview} alt="Preview" className="image-preview-thumb" />
                  <button className="image-preview-remove" onClick={removeSelectedImage}>✕</button>
                </div>
              )}

              <form onSubmit={sendMessage} className="input-form">
                {/* Hidden file input */}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="image-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  title="Attach an image"
                >
                  📎
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isListening ? 'Listening...' : 'Type your message...'}
                  disabled={isLoading}
                  className="message-input"
                />
                {speechSupported && (
                  <button
                    type="button"
                    className={`voice-btn${isListening ? ' voice-btn-active' : ''}`}
                    onClick={toggleVoiceInput}
                    disabled={isLoading}
                    title={isListening ? 'Stop listening' : 'Voice input'}
                  >
                    🎤
                    {isListening && (
                      <span className="voice-globe">
                        <span className="voice-globe-ring"></span>
                        <span className="voice-globe-core"></span>
                      </span>
                    )}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isLoading || (!input.trim() && !selectedImage)}
                  className="send-button"
                >
                  Send
                </button>
              </form>
            </div>
          </div>

          {/* Results Section */}
          {results && (
            <div className="results-section" ref={resultsRef}>
              <div style={{ zoom: resultsZoom }}>
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
            </div>
          )}
        </div>
      </div>
      <VirtualTryOn />
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
