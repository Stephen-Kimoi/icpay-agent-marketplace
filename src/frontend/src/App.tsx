import React from 'react';
import 'react-toastify/dist/ReactToastify.css';
import PaymentAgent from './pages/PaymentAgent';

const App: React.FC = () => {
  return (
    <div className="relative min-h-screen bg-black">
      <PaymentAgent />
    </div>
  );
};

export default App;