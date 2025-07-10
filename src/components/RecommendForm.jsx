import React, { useState, Fragment, useEffect, useRef } from 'react';
import { Transition } from '@headlessui/react';
import { Send, Clock } from 'lucide-react';

export default function RecommendForm() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMsg1, setShowMsg1] = useState(false);
  const [showMsg2, setShowMsg2] = useState(false);

  // Timeout state
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [offenseCount, setOffenseCount] = useState(0);

  const chatContainerRef = useRef(null);
  const typingIntervalRef = useRef(null);

  useEffect(() => {
    // This effect runs only once on mount and handles the initial message sequence
    const timers = [];
    if(typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    
    setMessages([]);
    setShowMsg1(false);
    setShowMsg2(false);

    const msg1 = { id: `${Date.now()}-1`, sender: 'master', content: '黙-묵-MUQ', type: 'h1' };
    const msg2 = { id: `${Date.now()}-2`, sender: 'master', content: '말 없는 책방', type: 'p' };
    const typingMessageId = `${Date.now()}-3`;
    const typingFullContent = '책방 묵(黙)\n이곳은 슬픔을 위한 조용한 책방입니다.\n이름을 묻거나 기록하지 않습니다.\n마스터는 말없이 책으로만 응답합니다.\n\n\n마스터가 조용히 고개를 끄덕입니다.';
    const msg3 = { id: typingMessageId, sender: 'master', content: '', type: 'p' };

    setMessages([msg1, msg2, msg3]);

    timers.push(setTimeout(() => setShowMsg1(true), 100)); // Start fade-in for msg1
    timers.push(setTimeout(() => setShowMsg2(true), 2000)); // Start fade-in for msg2
    
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
  useEffect(() => {
    if (isLocked && lockoutTime > 0) {
      const timer = setTimeout(() => {
        setLockoutTime(lockoutTime - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (lockoutTime === 0) {
      setIsLocked(false);
    }
  }, [isLocked, lockoutTime]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLocked || loading) return;

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
          const newOffenseCount = offenseCount + 1;
          setOffenseCount(newOffenseCount);
          
          if (newOffenseCount === 1) {
            // 1차 경고
            const warningMessage = {
              id: Date.now(),
              sender: 'master',
              content: "조용히 하세요. 이곳은 고민을 상담하는 공간입니다. 그런게 없다면 나가주세요."
            };
            // '생각 중...' 메시지를 경고 메시지로 교체
            return [...updatedMessages, warningMessage];
          } else {
            // 2차 제재 (1분 잠금)
            setIsLocked(true);
            setLockoutTime(60);
            // '생각 중...' 메시지를 제재 메시지로 교체
            return [...updatedMessages, { id: Date.now(), sender: 'master', content: data.message }];
          }
        } else {
          // 정상 응답 시, 페널티 카운트 초기화
          setOffenseCount(0);
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
          return [...updatedMessages, ...bookMessages].filter(Boolean);
        }
      });
    } catch (e) {
      // '생각 중' 메시지를 에러 메시지로 교체
      setMessages(prev => {
        console.log('[handleSubmit] API Error. Prev state:', prev);
        const updatedMessages = prev.filter(msg => msg && msg.id !== thinkingMessageId);
        const errorMessage = { id: Date.now(), sender: 'master', content: '지금은 마스터가 건강이 좋지 않아보입니다. 잠시 후 다시 시도해 주세요.' };
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
          {messages.filter(Boolean).map((msg, index) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`rounded-lg px-4 py-2 max-w-lg ${msg.sender === 'user' ? 'bg-muk-point text-white' : ''}`}>
                {(() => {
                  if (msg.type === 'h1') {
                    return <h1 className={`text-5xl font-serif text-center mb-2 transition-colors duration-[1500ms] ${showMsg1 ? 'text-muk-text' : 'text-muk-bg'}`}>{msg.content}</h1>;
                  }
                  if (msg.type === 'p' && index === 1) { // "말 없는 책방"
                    return <p className={`text-lg whitespace-pre-wrap text-left transition-colors duration-[1000ms] ${showMsg2 ? 'text-muk-subtext' : 'text-muk-bg'}`}>{msg.content}</p>;
                  }
                  if (msg.type === 'p') { // Other 'p' types like typing message
                    return <p className="text-lg text-muk-subtext whitespace-pre-wrap text-left">{msg.content}</p>;
                  }
                  if (msg.type === 'book') {
                    return (
                      <div className="text-left border-t border-muk-border/50 pt-4 mt-2 bg-muk-bg-light p-4 rounded-lg">
                        <h3 className="text-xl font-serif text-muk-text mb-1">{msg.content.title}</h3>
                        <p className="text-muk-subtext mb-2 text-sm">{msg.content.author}</p>
                        <p className="text-muk-text/90 mb-3 text-base">{msg.content.summary}</p>
                        <p className="text-muk-text/70 text-sm">{msg.content.reason}</p>
                      </div>
                    );
                  }
                  return <p className="whitespace-pre-wrap">{msg.content}</p>;
                })()}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Input Form Area */}
      <div className="p-4 border-t border-muk-border/50">
        {isLocked ? (
          <div className="flex items-center justify-center text-muk-subtext p-3 bg-muk-bg/50 border border-muk-border/70 rounded-lg">
            <Clock size={18} className="mr-2"/>
            {Math.floor(lockoutTime / 60)}분 {lockoutTime % 60}초 후 다시 대화할 수 있습니다.
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
} 