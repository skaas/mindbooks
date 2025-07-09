import React from 'react';
import RecommendForm from './components/RecommendForm';

function App() {
  console.log('App 컴포넌트 렌더링됨');
  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4">
      <div className="absolute top-2 left-2 text-xs text-gray-400">[DEBUG] App.jsx 렌더링됨</div>
      <RecommendForm />
    </div>
  );
}

export default App; 