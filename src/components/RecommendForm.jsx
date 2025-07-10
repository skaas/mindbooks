import React, { useState, Fragment, useEffect } from 'react';
import { Transition } from '@headlessui/react';

export default function RecommendForm() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [noEmotionMessage, setNoEmotionMessage] = useState('');
  const [submittedText, setSubmittedText] = useState('');

  const [showH1, setShowH1] = useState(false);
  const [showP1, setShowP1] = useState(false);
  const [showP2, setShowP2] = useState(false);
  const [animationsFinished, setAnimationsFinished] = useState(false);
  const [typedPlaceholder, setTypedPlaceholder] = useState('');

  const showForm = !loading && !result && !noEmotionMessage;

  useEffect(() => {
    if (showForm) {
      // 컴포넌트가 마운트된 후 애니메이션을 트리거하기 위해 짧은 지연을 줍니다.
      const animationStartTimer = setTimeout(() => {
        setShowH1(true);
        setShowP1(true);
        setShowP2(true);
      }, 50);

      // 애니메이션이 끝나는 시점에 placeholder 텍스트를 보여주기 위한 타이머
      const animationFinishTimer = setTimeout(() => {
        setAnimationsFinished(true);
      }, 1550); // 총 애니메이션 시간 1500ms + 초기 지연 50ms

      return () => {
        clearTimeout(animationStartTimer);
        clearTimeout(animationFinishTimer);
      };
    } else {
      setShowH1(false);
      setShowP1(false);
      setShowP2(false);
      setAnimationsFinished(false); // 폼이 사라질 때 상태 초기화
      setTypedPlaceholder(''); // 폼이 사라질 때 상태 초기화
    }
  }, [showForm]);

  useEffect(() => {
    if (animationsFinished) {
      const targetText = "마스터가 당신의 고민을 기다립니다.";
      let index = 0;
      setTypedPlaceholder(''); // 타이핑 시작 전 초기화
      const intervalId = setInterval(() => {
        if (index < targetText.length) {
          setTypedPlaceholder((prev) => prev + targetText.charAt(index));
          index++;
        } else {
          clearInterval(intervalId);
        }
      }, 100); // 타이핑 속도 (ms)

      return () => clearInterval(intervalId); // 컴포넌트 언마운트 시 인터벌 정리
    }
  }, [animationsFinished]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    setLoading(true);
    setResult(null);
    setNoEmotionMessage('');
    setSubmittedText(input);

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: input }),
      });

      if (!res.ok) {
        throw new Error('AI 서버에서 오류가 발생했습니다.');
      }

      const data = await res.json();
      
      if (data.hasEmotion === false) {
        setNoEmotionMessage(data.message);
      } else {
        setResult({
          books: (data["실제 존재하는 추천 도서 목록"] || []).map(book => ({
            title: book["제목"],
            author: book["작가"],
            summary: book["한 줄 요약"],
            reason: book["추천 이유"],
          })),
        });
      }
    } catch (e) {
      setNoEmotionMessage('책을 추천받지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
    setLoading(false);
    setInput('');
  };

  return (
    <div className="w-full max-w-2xl text-center">
      <Transition
        as={Fragment}
        show={showForm}
        enter="transition-opacity duration-700"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="w-[600px] text-center">
          <header className="mb-12 flex h-28 flex-col justify-center">
            <h1
              className={`text-5xl font-serif mb-2 transition-colors duration-[1500ms] delay-[0ms] ${
                showH1 ? 'text-muk-text' : 'text-muk-bg'
              }`}
            >
              黙
            </h1>
            <p
              className={`text-lg mb-4 transition-colors duration-[1200ms] delay-[300ms] ${
                showP1 ? 'text-muk-subtext' : 'text-muk-bg'
              }`}
            >
              말 없는 책방
            </p>
            <p
              className={`transition-colors duration-[1000ms] delay-[500ms] ${
                showP2 ? 'text-muk-text' : 'text-muk-bg'
              }`}
            >
              당신의 한 문장에, 책으로 대답합니다.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="h-28 flex items-center justify-center border border-muk-border rounded-lg focus-within:border-muk-point transition-colors duration-300">
              <textarea
                autoFocus
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={typedPlaceholder}
                className="w-full h-full p-4 bg-transparent text-center text-lg text-muk-text placeholder:text-muk-subtext placeholder:text-center focus:outline-none resize-none caret-muk-point"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading} 
              className="px-8 py-3 text-muk-subtext hover:text-muk-point disabled:text-gray-300 transition-colors duration-300"
            >
              책을 받아봅니다
            </button>
          </form>
        </div>
      </Transition>

      {loading && (
        <div className="w-full text-center text-muk-subtext">
          <p>당신의 문장을 읽고 있습니다...</p>
        </div>
      )}

      <Transition
        as={Fragment}
        show={!loading && (!!result || !!noEmotionMessage)}
        enter="transition-opacity duration-700 delay-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="w-full">
          <p className="text-lg text-muk-text mb-12 italic">“{submittedText}”</p>
          
          {noEmotionMessage && (
            <div className="text-muk-subtext">
              <p>{noEmotionMessage}</p>
            </div>
          )}

          {result && (
            <div className="space-y-12">
              {(result.books || []).map((book, i) => (
                <div key={i} className="text-left border-t border-muk-border pt-8">
                  <h3 className="text-2xl font-serif text-muk-text mb-1">{book.title}</h3>
                  <p className="text-muk-subtext mb-4">{book.author}</p>
                  <p className="text-muk-text mb-4">{book.summary}</p>
                  <p className="text-muk-text text-opacity-80">{book.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Transition>
    </div>
  );
} 