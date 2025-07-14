import React from 'react';
import { Clock, Tag, Book } from 'lucide-react';

export default function FeedItem({ item }) {
  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    
    if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}시간 전`;
    return `${Math.floor(diffInMinutes / 1440)}일 전`;
  };

  return (
    <div className="bg-muk-bg/80 border border-muk-border/30 rounded-lg p-6 mb-4 hover:bg-muk-bg/90 transition-colors">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-muk-point/20 rounded-full flex items-center justify-center">
            <span className="text-muk-point text-sm font-bold">묵</span>
          </div>
          <span className="text-muk-subtext text-sm">익명의 방문자</span>
        </div>
        <div className="flex items-center space-x-1 text-muk-subtext text-sm">
          <Clock size={14} />
          <span>{formatTimeAgo(item.timestamp)}</span>
        </div>
      </div>

      {/* 질문 내용 */}
      <div className="mb-4">
        <p className="text-muk-text leading-relaxed whitespace-pre-line">
          {item.question}
        </p>
      </div>

      {/* 키워드 태그들 */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {item.emotionKeywords.map((keyword, idx) => (
            <span
              key={`emotion-${idx}`}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
            >
              <Tag size={12} className="mr-1" />
              {keyword}
            </span>
          ))}
          {item.conceptKeywords.map((keyword, idx) => (
            <span
              key={`concept-${idx}`}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
            >
              <Tag size={12} className="mr-1" />
              {keyword}
            </span>
          ))}
        </div>
      </div>

      {/* 추천 도서 목록 */}
      <div className="border-t border-muk-border/20 pt-4">
        <div className="flex items-center mb-3">
          <Book size={16} className="text-muk-point mr-2" />
          <span className="text-muk-text font-medium">마스터의 추천 도서</span>
        </div>
        <div className="space-y-3">
          {item.books.map((book, idx) => (
            <div key={idx} className="bg-muk-bg/50 rounded-lg p-3 border border-muk-border/20">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-muk-text">{book.제목}</h4>
                <span className="text-muk-subtext text-sm">{book.작가}</span>
              </div>
              <p className="text-muk-subtext text-sm mb-2 italic">
                "{book['한 줄 요약']}"
              </p>
              <p className="text-muk-text text-sm leading-relaxed">
                {book['추천 이유']}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 