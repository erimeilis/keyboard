import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Key } from './Key';
import { mapKeyCodeToComponentId } from '../utils/keyMapping';
import './Keyboard.css';

const MODIFIER_KEYS = new Set([
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
  'Alt', 'MetaLeft', 'MetaRight'
]);

export const Keyboard: React.FC = () => {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [stickyModifiers, setStickyModifiers] = useState<Set<string>>(new Set());
  const [lockedModifiers, setLockedModifiers] = useState<Set<string>>(new Set());

  const handleKeyClick = async (keyCode: string) => {
    if (MODIFIER_KEYS.has(keyCode)) {
      setStickyModifiers(prev => {
        const next = new Set(prev);
        if (next.has(keyCode)) {
          next.delete(keyCode);
        } else {
          next.add(keyCode);
        }
        return next;
      });
      return;
    }

    const modifiers = [...stickyModifiers, ...lockedModifiers];
    try {
      await invoke('simulate_key', { keyCode, modifiers });
    } catch (e) {
      console.error('simulate_key failed:', e);
    }
    setStickyModifiers(new Set());
  };

  const handleModifierDoubleClick = (keyCode: string) => {
    setLockedModifiers(prev => {
      const next = new Set(prev);
      if (next.has(keyCode)) {
        next.delete(keyCode);
      } else {
        next.add(keyCode);
      }
      return next;
    });
    setStickyModifiers(prev => {
      const next = new Set(prev);
      next.delete(keyCode);
      return next;
    });
  };

  const isKeySticky = (keyCode: string) => stickyModifiers.has(keyCode);
  const isKeyLocked = (keyCode: string) => lockedModifiers.has(keyCode);
  const modifierClass = (keyCode: string) =>
    isKeyLocked(keyCode) ? 'key-locked' : isKeySticky(keyCode) ? 'key-sticky' : '';

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    // Set up event listener for batched keyboard state
    const setupListener = async () => {
      // Listen to batched keyboard state updates (throttled to 60fps)
      unlisten = await listen<string[]>('keyboard-state', (event) => {
        const componentIds = event.payload
          .map(mapKeyCodeToComponentId)
          .filter((id): id is string => id !== null);

        setPressedKeys(new Set(componentIds));
      });
    };

    setupListener();

    // Cleanup
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const isKeyPressed = (id: string) => pressedKeys.has(id);

  return (
    <div className="keyboard">
      {/* Row 1: Number row */}
      <div className="keyboard-row">
        <Key variant="single" label="esc" colorTheme="red" isPressed={isKeyPressed('esc')} onMouseClick={() => handleKeyClick('Escape')} />
        <Key variant="dualStack" top="1" bottom="!" isPressed={isKeyPressed('n1')} onMouseClick={() => handleKeyClick('Digit1')} />
        <Key variant="dualStack" top="2" bottom="@" isPressed={isKeyPressed('n2')} onMouseClick={() => handleKeyClick('Digit2')} />
        <Key variant="dualStack" top="3" bottom="#" isPressed={isKeyPressed('n3')} onMouseClick={() => handleKeyClick('Digit3')} />
        <Key variant="dualStack" top="4" bottom="$" isPressed={isKeyPressed('n4')} onMouseClick={() => handleKeyClick('Digit4')} />
        <Key variant="dualStack" top="5" bottom="%" colorTheme="gray" isPressed={isKeyPressed('n5')} onMouseClick={() => handleKeyClick('Digit5')} />
        <Key variant="dualStack" top="6" bottom="^" colorTheme="gray" isPressed={isKeyPressed('n6')} onMouseClick={() => handleKeyClick('Digit6')} />
        <Key variant="dualStack" top="7" bottom="&" colorTheme="gray" isPressed={isKeyPressed('n7')} onMouseClick={() => handleKeyClick('Digit7')} />
        <Key variant="dualStack" top="8" bottom="*" colorTheme="gray" isPressed={isKeyPressed('n8')} onMouseClick={() => handleKeyClick('Digit8')} />
        <Key variant="dualStack" top="9" bottom="(" isPressed={isKeyPressed('n9')} onMouseClick={() => handleKeyClick('Digit9')} />
        <Key variant="dualStack" top="0" bottom=")" isPressed={isKeyPressed('n0')} onMouseClick={() => handleKeyClick('Digit0')} />
        <Key variant="dualStack" top="-" bottom="—" isPressed={isKeyPressed('mn')} onMouseClick={() => handleKeyClick('Minus')} />
        <Key variant="dualStack" top="=" bottom="+" isPressed={isKeyPressed('eq')} onMouseClick={() => handleKeyClick('Equal')} />
        <Key variant="single" label="← backspace" width="fill" isPressed={isKeyPressed('backspace')} onMouseClick={() => handleKeyClick('Backspace')} />
        <Key variant="single" label="☀" />
      </div>

      {/* Row 2: QWERTY row */}
      <div className="keyboard-row">
        <Key variant="single" label="tab⇥" width={81} isPressed={isKeyPressed('tab')} onMouseClick={() => handleKeyClick('Tab')} />
        <Key variant="dualPos" primary="Q" secondary="/" isPressed={isKeyPressed('kq')} onMouseClick={() => handleKeyClick('KeyQ')} />
        <Key variant="dualPos" primary="W" secondary="'" isPressed={isKeyPressed('kw')} onMouseClick={() => handleKeyClick('KeyW')} />
        <Key variant="dualPos" primary="E" secondary="ק" isPressed={isKeyPressed('ke')} onMouseClick={() => handleKeyClick('KeyE')} />
        <Key variant="dualPos" primary="R" secondary="ר" isPressed={isKeyPressed('kr')} onMouseClick={() => handleKeyClick('KeyR')} />
        <Key variant="dualPos" primary="T" secondary="א" isPressed={isKeyPressed('kt')} onMouseClick={() => handleKeyClick('KeyT')} />
        <Key variant="dualPos" primary="Y" secondary="ט" isPressed={isKeyPressed('ky')} onMouseClick={() => handleKeyClick('KeyY')} />
        <Key variant="dualPos" primary="U" secondary="ו" isPressed={isKeyPressed('ku')} onMouseClick={() => handleKeyClick('KeyU')} />
        <Key variant="dualPos" primary="I" secondary="ן" isPressed={isKeyPressed('ki')} onMouseClick={() => handleKeyClick('KeyI')} />
        <Key variant="dualPos" primary="O" secondary="ם" isPressed={isKeyPressed('ko')} onMouseClick={() => handleKeyClick('KeyO')} />
        <Key variant="dualPos" primary="P" secondary="פ" isPressed={isKeyPressed('kp')} onMouseClick={() => handleKeyClick('KeyP')} />
        <Key variant="dualStack" top="{" bottom="[" isPressed={isKeyPressed('lb')} onMouseClick={() => handleKeyClick('BracketLeft')} />
        <Key variant="dualStack" top="}" bottom="]" isPressed={isKeyPressed('rb')} onMouseClick={() => handleKeyClick('BracketRight')} />
        <Key variant="dualStack" top="|" bottom="\" width="fill" colorTheme="gray" isPressed={isKeyPressed('bs')} onMouseClick={() => handleKeyClick('Backslash')} />
        <Key variant="single" label="home" />
      </div>

      {/* Row 3: ASDF row */}
      <div className="keyboard-row">
        <Key variant="single" label="caps lock" width={95} onMouseClick={() => handleKeyClick('CapsLock')} />
        <Key variant="dualPos" primary="A" secondary="ש" isPressed={isKeyPressed('ka')} onMouseClick={() => handleKeyClick('KeyA')} />
        <Key variant="dualPos" primary="S" secondary="ד" isPressed={isKeyPressed('ks')} onMouseClick={() => handleKeyClick('KeyS')} />
        <Key variant="dualPos" primary="D" secondary="ג" isPressed={isKeyPressed('kd')} onMouseClick={() => handleKeyClick('KeyD')} />
        <Key variant="dualPos" primary="F" secondary="כ" isPressed={isKeyPressed('kf')} onMouseClick={() => handleKeyClick('KeyF')} />
        <Key variant="dualPos" primary="G" secondary="ע" isPressed={isKeyPressed('kg')} onMouseClick={() => handleKeyClick('KeyG')} />
        <Key variant="dualPos" primary="H" secondary="י" isPressed={isKeyPressed('kh')} onMouseClick={() => handleKeyClick('KeyH')} />
        <Key variant="dualPos" primary="J" secondary="ח" isPressed={isKeyPressed('kj')} onMouseClick={() => handleKeyClick('KeyJ')} />
        <Key variant="dualPos" primary="K" secondary="ל" isPressed={isKeyPressed('kk')} onMouseClick={() => handleKeyClick('KeyK')} />
        <Key variant="dualPos" primary="L" secondary="ך" isPressed={isKeyPressed('kl')} onMouseClick={() => handleKeyClick('KeyL')} />
        <Key variant="dualPos" primary=":" secondary="ף" isPressed={isKeyPressed('semi')} onMouseClick={() => handleKeyClick('Semicolon')} />
        <Key variant="dualPos" primary="&quot;" secondary="," isPressed={isKeyPressed('quot')} onMouseClick={() => handleKeyClick('Quote')} />
        <Key variant="single" label="← enter" colorTheme="red" width="fill" isPressed={isKeyPressed('enter')} onMouseClick={() => handleKeyClick('Enter')} />
        <Key variant="single" label="pgup" />
      </div>

      {/* Row 4: ZXCV row */}
      <div className="keyboard-row">
        <Key variant="single" label="⇧ shift" width="fill" isPressed={isKeyPressed('lshift')} onMouseClick={() => handleKeyClick('ShiftLeft')} onDoubleClick={() => handleModifierDoubleClick('ShiftLeft')} className={modifierClass('ShiftLeft')} />
        <Key variant="dualPos" primary="Z" secondary="ז" isPressed={isKeyPressed('kz')} onMouseClick={() => handleKeyClick('KeyZ')} />
        <Key variant="dualPos" primary="X" secondary="ס" isPressed={isKeyPressed('kx')} onMouseClick={() => handleKeyClick('KeyX')} />
        <Key variant="dualPos" primary="C" secondary="ב" isPressed={isKeyPressed('kc')} onMouseClick={() => handleKeyClick('KeyC')} />
        <Key variant="dualPos" primary="V" secondary="ה" isPressed={isKeyPressed('kv')} onMouseClick={() => handleKeyClick('KeyV')} />
        <Key variant="dualPos" primary="B" secondary="נ" isPressed={isKeyPressed('kb')} onMouseClick={() => handleKeyClick('KeyB')} />
        <Key variant="dualPos" primary="N" secondary="מ" isPressed={isKeyPressed('kn')} onMouseClick={() => handleKeyClick('KeyN')} />
        <Key variant="dualPos" primary="M" secondary="צ" isPressed={isKeyPressed('km')} onMouseClick={() => handleKeyClick('KeyM')} />
        <Key variant="dualPos" primary="<" secondary="ת" isPressed={isKeyPressed('comma')} onMouseClick={() => handleKeyClick('Comma')} />
        <Key variant="dualPos" primary=">" secondary="ץ" isPressed={isKeyPressed('dot')} onMouseClick={() => handleKeyClick('Period')} />
        <Key variant="dualPos" primary="?" secondary="." isPressed={isKeyPressed('slash')} onMouseClick={() => handleKeyClick('Slash')} />
        <Key variant="single" label="⇧ shift" width={95} isPressed={isKeyPressed('rshift')} onMouseClick={() => handleKeyClick('ShiftRight')} onDoubleClick={() => handleModifierDoubleClick('ShiftRight')} className={modifierClass('ShiftRight')} />
        <Key variant="icon" iconName="chevron-up" onMouseClick={() => handleKeyClick('ArrowUp')} />
        <Key variant="single" label="pgdn" />
      </div>

      {/* Row 5: Bottom row */}
      <div className="keyboard-row">
        <Key variant="single" label="control" width={68} onMouseClick={() => handleKeyClick('ControlLeft')} onDoubleClick={() => handleModifierDoubleClick('ControlLeft')} className={modifierClass('ControlLeft')} />
        <Key variant="single" label="option" width={68} onMouseClick={() => handleKeyClick('Alt')} onDoubleClick={() => handleModifierDoubleClick('Alt')} className={modifierClass('Alt')} />
        <Key variant="icon" iconName="command" width={68} colorTheme="gray" onMouseClick={() => handleKeyClick('MetaLeft')} onDoubleClick={() => handleModifierDoubleClick('MetaLeft')} className={modifierClass('MetaLeft')} />
        <Key variant="single" label="" width="fill" isPressed={isKeyPressed('space')} onMouseClick={() => handleKeyClick('Space')} />
        <Key variant="icon" iconName="command" colorTheme="gray" onMouseClick={() => handleKeyClick('MetaRight')} onDoubleClick={() => handleModifierDoubleClick('MetaRight')} className={modifierClass('MetaRight')} />
        <Key variant="single" label="fn1" />
        <Key variant="single" label="fn2" />
        <Key variant="icon" iconName="chevron-left" onMouseClick={() => handleKeyClick('ArrowLeft')} />
        <Key variant="icon" iconName="chevron-down" onMouseClick={() => handleKeyClick('ArrowDown')} />
        <Key variant="icon" iconName="chevron-right" onMouseClick={() => handleKeyClick('ArrowRight')} />
      </div>
    </div>
  );
};
