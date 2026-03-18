'use client';

import { useChat } from '@ai-sdk/react';
import { useRef, useEffect, useState } from 'react';

export default function ChatPage() {
  const { messages, status, error, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSend() {
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput('');
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #222',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#111',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <a href="/" style={{ color: '#888', textDecoration: 'none', fontSize: '0.85rem' }}>
            ← Dashboard
          </a>
          <h1 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
            AI Assistant
          </h1>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#555' }}>
          Claude Sonnet 4
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            marginTop: '20vh',
            color: '#555',
          }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Hey Stelios - what do you need?</p>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              justifyContent: 'center',
              marginTop: '1.5rem',
            }}>
              {[
                'What\'s my save rate?',
                'What emails need response?',
                'What are my action items?',
                'Look up [account name]',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    sendMessage({ text: suggestion });
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '20px',
                    border: '1px solid #333',
                    background: '#1a1a1a',
                    color: '#aaa',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                background: message.role === 'user' ? '#1a73e8' : '#1a1a1a',
                border: message.role === 'user' ? 'none' : '1px solid #333',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message.parts?.map((part, i) => {
                if (part.type === 'text') {
                  return <span key={i}>{part.text}</span>;
                }
                if (part.type.startsWith('tool-')) {
                  const toolName = part.type.replace('tool-', '');
                  return (
                    <div key={i} style={{
                      padding: '0.5rem',
                      margin: '0.5rem 0',
                      borderRadius: '6px',
                      background: '#0d1117',
                      border: '1px solid #333',
                      fontSize: '0.8rem',
                      color: '#8b949e',
                    }}>
                      {'result' in part
                        ? <span>Found data from {toolName}</span>
                        : <span>Searching {toolName.replace(/([A-Z])/g, ' $1').toLowerCase()}...</span>
                      }
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-start',
          }}>
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              background: '#1a1a1a',
              border: '1px solid #333',
              color: '#888',
              fontSize: '0.9rem',
            }}>
              Thinking...
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: '#2d1b1b',
            border: '1px solid #5c2020',
            color: '#ff6b6b',
            fontSize: '0.85rem',
          }}>
            Error: {error.message}
          </div>
        )}
      </div>

      {/* Input */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderTop: '1px solid #222',
          background: '#111',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-end',
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask me anything about your accounts, save desk, emails..."
          rows={1}
          style={{
            flex: 1,
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid #333',
            background: '#1a1a1a',
            color: '#fff',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
            resize: 'none',
            outline: 'none',
            minHeight: '42px',
            maxHeight: '120px',
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          style={{
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            background: isLoading || !input.trim() ? '#333' : '#1a73e8',
            color: '#fff',
            fontSize: '0.9rem',
            fontWeight: 500,
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
