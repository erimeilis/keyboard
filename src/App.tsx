import React from 'react';
import { Keyboard } from './components/Keyboard';
import { useKeyboardLayout } from './hooks/useKeyboardLayout';
import './App.css';

function App() {
  const activeLayout = useKeyboardLayout();

  return (
    <div className="app-container">
      <div className="keyboard-wrapper" data-active-lang={activeLayout}>
        <Keyboard />
      </div>
    </div>
  );
}

export default App;
