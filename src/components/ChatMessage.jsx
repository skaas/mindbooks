import React from 'react';

// 메시지 내용 렌더링을 위한 도우미 컴포넌트
const MessageContent = ({ msg }) => {
  switch (msg.type) {
    case 'h1':
      return <h1 className="text-5xl font-serif mb-2">{msg.content}</h1>;
    case 'p':
      return <p className="text-lg whitespace-pre-wrap">{msg.content}</p>;
    case 'book':
      return (
        <div className="border-t border-muk-border/50 pt-4 mt-2">
          <h3 className="text-xl font-serif mb-1">{msg.content.title}</h3>
          <p className="text-muk-subtext mb-2 text-sm">{msg.content.author}</p>
          <p className="text-muk-text/90 mb-3 text-base">{msg.content.summary}</p>
          <p className="text-muk-text/70 text-sm">{msg.content.reason}</p>
        </div>
      );
    default:
      return <p className="whitespace-pre-wrap">{msg.content}</p>;
  }
};

const ChatMessage = ({ msg }) => {
  // 정렬 및 기본 스타일 결정
  const alignment = {
    user: 'justify-end',
    master: 'justify-start',
    system: 'justify-center',
  }[msg.sender] || 'justify-start';

  const bubbleStyle = {
    user: 'bg-muk-point text-white',
    master: 'bg-muk-bg-light',
    system: '', // No bubble for system messages
  }[msg.sender] || 'bg-muk-bg-light';

  const textAlignment = msg.sender === 'system' ? 'text-center' : 'text-left';

  return (
    <div className={`flex w-full ${alignment}`}>
      <div className={`rounded-lg px-4 py-2 max-w-lg ${bubbleStyle} ${textAlignment}`}>
        <MessageContent msg={msg} />
      </div>
    </div>
  );
};

export default ChatMessage; 