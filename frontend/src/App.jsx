import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import './App.css'

const API_URL = 'http://127.0.0.1:8000'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState(null)
  const messagesEndRef = useRef(null)

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Initialize chat on mount
  useEffect(() => {
    const initChat = async () => {
      try {
        const response = await axios.post(`${API_URL}/chat`, {
          message: '',
          history: []
        })

        setMessages([{
          role: 'assistant',
          content: response.data.message
        }])
      } catch (error) {
        console.error('Error initializing chat:', error)
      }
    }

    initChat()
  }, [])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    // Add user message to chat
    const newMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)

    try {
      // Prepare history for API
      const history = newMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const response = await axios.post(`${API_URL}/chat`, {
        message: userMessage,
        history: history.slice(0, -1) // Exclude the message we just added
      })

      // Add assistant response
      setMessages([...newMessages, {
        role: 'assistant',
        content: response.data.message
      }])

      // If we got results, display them
      if (response.data.type === 'results' && response.data.results) {
        setResults(response.data.results)
      }

    } catch (error) {
      console.error('Error sending message:', error)
      setMessages([...newMessages, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🛍️ AI Shopping Assistant</h1>
        <p>Find the best deals on eBay and Amazon</p>
      </header>

      <div className="container">
        {/* Chat Section */}
        <div className="chat-section">
          <div className="chat-container">
            <div className="messages">
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

export default App
