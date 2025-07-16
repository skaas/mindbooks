import React, { useState, useEffect, useRef } from 'react';
import { Send, X, BookOpen } from 'lucide-react';
import ChatMessage from './ChatMessage';

export default function ChatModal({ isOpen, onClose }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accumulatedTags, setAccumulatedTags] = useState({
    emotions: [],
    concepts: []
  });

  const chatContainerRef = useRef(null);
  const typingIntervalRef = useRef(null);

  // 책 추천 가능 여부 확인
  const canRecommend = accumulatedTags.emotions.length > 0 && accumulatedTags.concepts.length > 0;

  // 모달이 열릴 때마다 초기화
  useEffect(() => {
    if (!isOpen) return;

    const timers = [];
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    
    setMessages([]);
    setInput('');
    setLoading(false);
    setAccumulatedTags({ emotions: [], concepts: [] });

    const msg1 = { id: `${Date.now()}-1`, sender: 'system', content: '黙-묵-MUQ', type: 'h1' };
    const msg2 = { id: `${Date.now()}-2`, sender: 'system', content: '말 없는 책방', type: 'p' };
    const typingMessageId = `${Date.now()}-3`;
    const typingFullContent = '책방 묵(黙)\n이곳은 슬픔을 위한 조용한 책방입니다.\n\n어서오세요. 오늘은 어떤 이야기를 들려주시겠어요?\n감정과 고민을 모두 파악한 후 책을 추천해드리겠습니다.';
    const msg3 = { id: typingMessageId, sender: 'master', content: '', type: 'p' };

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
    }, 1000));

    return () => {
        timers.forEach(clearTimeout);
        if(typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    };
  }, [isOpen]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { id: Date.now(), sender: 'user', content: input };
    const thinkingMessageId = Date.now() + 1;
    const thinkingMessage = { id: thinkingMessageId, sender: 'master', content: '...' };
    const originalInput = input;

    setMessages(prev => [...prev, userMessage, thinkingMessage].filter(Boolean));
    setInput('');
    setLoading(true);

    try {
      console.log('=== API 호출 시작 ===');
      console.log('사용자 입력:', originalInput);
      console.log('모드:', 'analyze');
      console.log('누적 태그:', accumulatedTags);
      
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userInput: originalInput,
          accumulatedTags: accumulatedTags
        }),
      });
      
      console.log('API 응답 상태:', res.status, res.statusText);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('API 오류 응답:', errorText);
        throw new Error('AI 서버에서 오류가 발생했습니다.');
      }

      const data = await res.json();
      console.log('API 응답 데이터:', data);
      
      // 최근 발화의 감정과 컨셉 태그 로그 출력
      console.log('=== 최근 발화 분석 결과 ===');
      console.log('새로 감지된 감정 태그:', data.newTags?.emotions || []);
      console.log('새로 감지된 컨셉 태그:', data.newTags?.concepts || []);
      
      // 누적 태그 업데이트
      setAccumulatedTags(data.accumulatedTags || { emotions: [], concepts: [] });
      
      // 현재 누적된 태그들 로그 출력
      console.log('=== 현재 누적된 태그들 ===');
      console.log('누적된 감정 태그:', data.accumulatedTags?.emotions || []);
      console.log('누적된 컨셉 태그:', data.accumulatedTags?.concepts || []);

      setMessages(prev => {
        const updatedMessages = prev.filter(msg => msg && msg.id !== thinkingMessageId);
        const masterMessage = { id: Date.now(), sender: 'master', content: data.message };
        
        // 새로운 태그가 감지되었으면 태그 메시지 추가
        let newMessages = [masterMessage];
        
        if (data.newTags && (data.newTags.emotions.length > 0 || data.newTags.concepts.length > 0)) {
          let tagContent = '🏷️ 새로 감지된 태그:\n';
          if (data.newTags.emotions.length > 0) {
            tagContent += `감정: ${data.newTags.emotions.join(', ')}\n`;
          }
          if (data.newTags.concepts.length > 0) {
            tagContent += `개념: ${data.newTags.concepts.join(', ')}`;
          }
          
          const tagMessage = { 
            id: Date.now() + 0.5, 
            sender: 'system', 
            content: tagContent,
            type: 'tags'
          };
          newMessages.push(tagMessage);
        }
        
        return [...updatedMessages, ...newMessages];
      });
    } catch (e) {
      setMessages(prev => {
        const updatedMessages = prev.filter(msg => msg && msg.id !== thinkingMessageId);
        const errorMessage = { id: Date.now(), sender: 'system', content: '지금은 마스터가 건강이 좋지 않아보입니다.\n잠시 후 다시 시도해 주세요.' };
        return [...updatedMessages, errorMessage].filter(Boolean);
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendation = async () => {
    if (!canRecommend || loading) return;

    const recommendMessageId = Date.now();
    const recommendMessage = { id: recommendMessageId, sender: 'master', content: '책을 찾아보고 있습니다...' };
    
    setMessages(prev => [...prev, recommendMessage]);
    setLoading(true);

    try {
      const res = await fetch('/api/book-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accumulatedTags: accumulatedTags
        }),
      });

      if (!res.ok) {
        throw new Error('책 추천 중 오류가 발생했습니다.');
      }

      const data = await res.json();
      
      setMessages(prev => {
        const updatedMessages = prev.filter(msg => msg && msg.id !== recommendMessageId);
        const bookIntroMessage = { id: Date.now(), sender: 'master', content: '마스터가 당신을 위한 책을 찾았습니다.' };
        
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
      });
    } catch (e) {
      setMessages(prev => {
        const updatedMessages = prev.filter(msg => msg && msg.id !== recommendMessageId);
        const errorMessage = { id: Date.now(), sender: 'system', content: '책 추천 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.' };
        return [...updatedMessages, errorMessage].filter(Boolean);
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-muk-bg rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-muk-border/50">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-medium text-muk-text">마스터와의 상담</h2>
            
            {/* 태그 상태 표시 */}
            <div className="flex items-center space-x-2 text-sm">
              <div className={`px-2 py-1 rounded-full text-xs ${
                accumulatedTags.emotions.length > 0 
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' 
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                감정 {accumulatedTags.emotions.length > 0 ? `(${accumulatedTags.emotions.length})` : ''}
              </div>
              <div className={`px-2 py-1 rounded-full text-xs ${
                accumulatedTags.concepts.length > 0 
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                개념 {accumulatedTags.concepts.length > 0 ? `(${accumulatedTags.concepts.length})` : ''}
              </div>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-muk-border/20 rounded-full transition-colors"
          >
            <X size={20} className="text-muk-subtext" />
          </button>
        </div>

        {/* 채팅 영역 */}
        <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto">
          <div className="w-full max-w-2xl mx-auto space-y-4">
            {messages.filter(Boolean).map((msg) => (
              <ChatMessage key={msg.id} msg={msg} />
            ))}
          </div>
        </div>

        {/* 입력 영역 */}
        <div className="p-4 border-t border-muk-border/50">
          <div className="max-w-3xl mx-auto space-y-3">
            {/* 책 추천 버튼 */}
            {canRecommend && (
              <div className="flex justify-center">
                <button
                  onClick={handleRecommendation}
                  disabled={loading}
                  className="flex items-center space-x-2 px-6 py-3 bg-muk-point text-muk-bg rounded-lg hover:bg-muk-point/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <BookOpen size={20} />
                  <span>책 추천받기</span>
                </button>
              </div>
            )}
            
            {/* 입력 폼 */}
            <form onSubmit={handleSubmit} className="flex items-center space-x-2">
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
      </div>
    </div>
  );
} 