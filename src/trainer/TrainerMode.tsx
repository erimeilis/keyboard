import React, { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Keyboard } from '../components/Keyboard';

export const TrainerMode: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  useEffect(() => {
    invoke('set_trainer_mode', { active: true }).catch(console.error);
    return () => { invoke('set_trainer_mode', { active: false }).catch(console.error); };
  }, []);

  return (
    <div className="trainer-mode">
      <div className="trainer-topbar">
        <button onClick={onExit}>Exit trainer</button>
      </div>
      <div className="trainer-panel">{/* PracticePanel mounts here in Task 21 */}</div>
      <Keyboard />
    </div>
  );
};
