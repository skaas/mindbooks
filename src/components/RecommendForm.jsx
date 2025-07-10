import React, { useState } from 'react';

export default function RecommendForm() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [noEmotionMessage, setNoEmotionMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setNoEmotionMessage('');
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: input }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        alert('AI 서버에서 오류가 발생했습니다.');
        setLoading(false);
        return;
      }

      const data = await res.json();
      
      if (data.hasEmotion === false) {
        setNoEmotionMessage(data.message);
        setLoading(false);
        return;
      }

      // 서버 응답 키에 맞게 파싱
      setResult({
        emotionKeywords: data["감정 키워드"] || [],
        conceptKeywords: data["인식/개념 키워드"] || [],
        books: (data["실제 존재하는 추천 도서 목록"] || []).map(book => ({
          title: book["제목"],
          author: book["작가"],
          summary: book["한 줄 요약"],
          reason: book["추천 이유"],
        })),
      });
    } catch (e) {
      alert('AI 서버와 통신에 실패했습니다.');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-6 md:p-10 mt-10">
      <h1 className="text-4xl md:text-5xl font-bold text-gray-800 text-center mb-2">문장 약국 💊</h1>
      <p className="text-gray-500 text-center mb-6">당신의 문장에 마음을 처방해 드립니다.</p>
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="요즘 어떤 마음이신가요? 문장을 남겨주세요.\n예: 사람들이 다 나를 좋은 사람이라는데, 왜 나는 혼자일까?"
        className="w-full h-28 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition resize-none"
      />
      <button type="submit" disabled={loading} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105">
        {loading ? '처방 중...' : '마음 처방받기'}
      </button>
      {loading && <div className="flex justify-center my-8"><div className="w-12 h-12 border-4 border-gray-200 rounded-full border-t-blue-500 animate-spin"></div></div>}
      {noEmotionMessage && (
        <div className="mt-6 text-center text-red-500 bg-red-100 border border-red-400 p-4 rounded-lg">
          {noEmotionMessage}
        </div>
      )}
      {result && (
        <div className="mt-10">
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">AI 마음 분석 결과</h3>
            <div className="mb-3">
              <strong className="text-gray-600">감정 키워드:</strong>
              <div className="flex flex-wrap gap-2 mt-2">
                {(result.emotionKeywords || []).map((kw, i) => <span key={i} className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">{kw}</span>)}
              </div>
            </div>
            <div>
              <strong className="text-gray-600">개념 키워드:</strong>
              <div className="flex flex-wrap gap-2 mt-2">
                {(result.conceptKeywords || []).map((kw, i) => <span key={i} className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">{kw}</span>)}
              </div>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4 mt-12 text-center">마음 처방 서재</h3>
          {(result.books || []).map((book, i) => (
            <div key={i} className="flex flex-col md:flex-row gap-6 bg-white border border-gray-200 rounded-lg p-6 mb-4 transform hover:shadow-md transition-shadow">
              <img src={`https://placehold.co/120x170/E2E8F0/334155?text=${encodeURIComponent(book.title)}`} alt={`${book.title} 책 표지`} className="w-24 h-36 md:w-32 md:h-48 object-cover rounded-md mx-auto md:mx-0 flex-shrink-0" />
              <div className="flex-grow">
                <h4 className="text-xl font-bold text-gray-900">{book.title}</h4>
                <p className="text-md text-gray-500 mb-3">{book.author}</p>
                <p className="text-gray-700 mb-4 text-sm">{book.summary}</p>
                <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-900 p-4 rounded-r-lg text-sm">
                  <strong className="font-bold">추천 이유:</strong> {book.reason}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </form>
  );
} 