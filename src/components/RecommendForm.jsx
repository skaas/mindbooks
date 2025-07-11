import React, { useState, useEffect, useRef } from 'react';
import { Send, Clock } from 'lucide-react';
import ChatMessage from './ChatMessage';

export default function RecommendForm() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const chatContainerRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const typingMessageIdRef = useRef('');
  const typingFullContentRef = useRef('');

  useEffect(() => {
    const timers = [];
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    
    setMessages([]);

    const msg1 = { id: `${Date.now()}-1`, sender: 'system', content: '黙-묵-MUQ', type: 'h1' };
    const msg2 = { id: `${Date.now()}-2`, sender: 'system', content: '말 없는 책방', type: 'p' };
    const typingMessageId = `${Date.now()}-3`;
    const typingFullContent = '책방 묵(黙)\n이곳은 슬픔을 위한 조용한 책방입니다.\n이름을 묻거나 기록하지 않습니다.\n마스터는 말없이 책으로만 응답합니다.\n\n\n어서오세요. 오늘 어떤 힘든일이 있으셨나요?';
    const msg3 = { id: typingMessageId, sender: 'master', content: '', type: 'p' };

    typingMessageIdRef.current = typingMessageId;
    typingFullContentRef.current = typingFullContent;

    setMessages([msg1, msg2, msg3]);

    timers.push(setTimeout(() => {
        typingIntervalRef.current = setInterval(() => {
            setMessages(prev => {
                const currentMsg = prev.find(m => m.id === typingMessageId);
                if (!currentMsg || currentMsg.content.length >= typingFullContent.length) {
                    clearInterval(typingIntervalRef.current);
                    return prev;
                }
                return prev.map(m => 
                    m.id === typingMessageId 
                        ? { ...m, content: typingFullContent.slice(0, m.content.length + 1) } 
                        : m
                );
            });
        }, 75);
    }, 2000)); // Start typing with msg2 animation

    return () => {
        timers.forEach(clearTimeout);
        if(typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Timeout countdown timer
  


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { id: Date.now(), sender: 'user', content: input };
    const thinkingMessageId = Date.now() + 1;
    const thinkingMessage = { id: thinkingMessageId, sender: 'master', content: '...' };
    const originalInput = input; // API 요청에 사용하기 위해 현재 입력을 저장

    // 사용자와 '생각 중' 메시지를 한 번에 추가
    setMessages(prev => {
      console.log('[handleSubmit] Adding user message. Prev state:', prev);
      const nextState = [...prev, userMessage, thinkingMessage].filter(Boolean);
      console.log('[handleSubmit] Adding user message. Next state:', nextState);
      return nextState;
    });
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: originalInput }),
      });

      if (!res.ok) {
        throw new Error('AI 서버에서 오류가 발생했습니다.');
      }

      const data = await res.json();
      
      // '생각 중' 메시지를 실제 응답으로 교체
      setMessages(prev => {
        const updatedMessages = prev.filter(msg => msg && msg.id !== thinkingMessageId);
        
        if (data.hasEmotion === false) {
          // It's a guiding message, not a book recommendation.
          const masterMessage = { id: Date.now(), sender: 'master', content: data.message };
          return [...updatedMessages, masterMessage];
        } else {
          // It's a book recommendation. First, add the "now let's get a book" message.
          const bookIntroMessage = { id: Date.now(), sender: 'master', content: data.message };
          
          const books = (data["실제 존재하는 추천 도서 목록"] || []);
          const bookMessages = books.map((book, index) => ({
            id: `${Date.now()}-${index}`,
            sender: 'master',
            type: 'book',
            content: {
              title: book["제목"],
              author: book["작가"],
              summary: book["한 줄 요약"],
              reason: book["추천 이유"],
            }
          }));
          return [...updatedMessages, bookIntroMessage, ...bookMessages];
        }
      });
    } catch (e) {
      // '생각 중' 메시지를 에러 메시지로 교체
      setMessages(prev => {
        console.log('[handleSubmit] API Error. Prev state:', prev);
        const updatedMessages = prev.filter(msg => msg && msg.id !== thinkingMessageId);
        const errorMessage = { id: Date.now(), sender: 'system', content: '지금은 마스터가 건강이 좋지 않아보입니다.\n잠시 후 다시 시도해 주세요.' };
        const nextState = [...updatedMessages, errorMessage].filter(Boolean);
        console.log('[handleSubmit] API Error. Next state:', nextState);
        return nextState;
      });
    } finally {
      setLoading(false);
    }
  };

  console.log('%c--- Rendering ---', 'color: yellow; font-weight: bold;');
  console.log('Current `messages` state:', JSON.stringify(messages, null, 2));

  return (
    <div className="flex flex-col h-screen bg-muk-bg text-muk-text font-serif">
      {/* Main Content Area */}
      <main ref={chatContainerRef} className="flex-grow flex flex-col p-4 overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto space-y-4">
          {messages.filter(Boolean).map((msg) => (
            <ChatMessage key={msg.id} msg={msg} />
          ))}
        </div>
      </main>

      {/* Input Form Area */}
      <div className="p-4 border-t border-muk-border/50">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2 max-w-3xl mx-auto">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="이곳에 이야기를 들려주세요..."
            className="flex-grow p-3 bg-muk-bg/50 border border-muk-border/70 rounded-lg focus:outline-none focus:ring-1 focus:ring-muk-point resize-none"
            rows="1"
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-3 rounded-full bg-muk-point text-muk-bg disabled:bg-muk-subtext/50 disabled:cursor-not-allowed hover:bg-opacity-80 transition-colors"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
} 