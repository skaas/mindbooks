import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import FeedItem from './FeedItem';
import ChatModal from './ChatModal';

export default function RecommendForm() {
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeedData = async () => {
    try {
      const response = await fetch('/api/feed');
      if (!response.ok) throw new Error('피드 데이터를 불러올 수 없습니다.');
      const data = await response.json();
      setFeedItems(data.feedItems || []);
    } catch (error) {
      console.error('피드 데이터 로딩 오류:', error);
      setFeedItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFeedData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFeedData();
  };

  const openChatModal = () => {
    setChatModalOpen(true);
  };

  const closeChatModal = () => {
    setChatModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-muk-bg text-muk-text font-serif">
      {/* 헤더 */}
      <header className="sticky top-0 bg-muk-bg/95 backdrop-blur-sm border-b border-muk-border/50 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-muk-text">黙-묵-MUQ</h1>
              <p className="text-muk-subtext text-sm">말 없는 책방</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-muk-border/20 rounded-full transition-colors disabled:opacity-50"
            >
              <RefreshCw size={20} className={`text-muk-subtext ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* 메인 피드 영역 */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-muk-point mx-auto mb-4"></div>
              <p className="text-muk-subtext">다른 방문자들의 이야기를 불러오고 있습니다...</p>
            </div>
          </div>
        ) : feedItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muk-subtext mb-4">아직 아무도 이야기를 나누지 않았습니다.</p>
            <p className="text-muk-subtext">첫 번째 방문자가 되어보세요.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center py-6 border-b border-muk-border/30">
              <h2 className="text-lg font-medium text-muk-text mb-2">다른 방문자들의 이야기</h2>
              <p className="text-muk-subtext text-sm">
                익명의 방문자들이 나눈 고민과 마스터의 추천 도서를 확인해보세요.
                <br />
                준비가 되시면 아래 + 버튼을 눌러 마스터와 대화를 시작하세요.
              </p>
            </div>
            
            {feedItems.map((item) => (
              <FeedItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      {/* 플로팅 채팅 버튼 */}
      <button
        onClick={openChatModal}
        className="fixed bottom-6 right-6 w-14 h-14 bg-muk-point text-muk-bg rounded-full shadow-lg hover:bg-muk-point/90 transition-colors flex items-center justify-center z-50"
      >
        <Plus size={24} />
      </button>

      {/* 채팅 모달 */}
      <ChatModal isOpen={chatModalOpen} onClose={closeChatModal} />
    </div>
  );
} 