import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Key } from './Key';
import { mapKeyCodeToComponentId } from '../utils/keyMapping';
import { TrainerKeyboardProvider } from '../trainer/components/TrainerKeyboardContext';
import type { KeyboardView } from '../trainer/types';
import './Keyboard.css';

const MODIFIER_KEYS = new Set([
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
  'Alt', 'MetaLeft', 'MetaRight'
]);

export const Keyboard: React.FC<{ trainerView?: KeyboardView }> = ({ trainerView }) => {
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
    <TrainerKeyboardProvider value={trainerView ?? null}>
      <div className="keyboard">
        {/* Row 1: Number row */}
        <div className="keyboard-row">
          <Key variant="single" label="esc" colorTheme="red" id="esc" isPressed={isKeyPressed('esc')} onMouseClick={() => handleKeyClick('Escape')} />
          <Key variant="dualStack" top="1" bottom="!" id="n1" isPressed={isKeyPressed('n1')} onMouseClick={() => handleKeyClick('Digit1')} />
          <Key variant="dualStack" top="2" bottom="@" id="n2" isPressed={isKeyPressed('n2')} onMouseClick={() => handleKeyClick('Digit2')} />
          <Key variant="dualStack" top="3" bottom="#" id="n3" isPressed={isKeyPressed('n3')} onMouseClick={() => handleKeyClick('Digit3')} />
          <Key variant="dualStack" top="4" bottom="$" id="n4" isPressed={isKeyPressed('n4')} onMouseClick={() => handleKeyClick('Digit4')} />
          <Key variant="dualStack" top="5" bottom="%" colorTheme="gray" id="n5" isPressed={isKeyPressed('n5')} onMouseClick={() => handleKeyClick('Digit5')} />
          <Key variant="dualStack" top="6" bottom="^" colorTheme="gray" id="n6" isPressed={isKeyPressed('n6')} onMouseClick={() => handleKeyClick('Digit6')} />
          <Key variant="dualStack" top="7" bottom="&" colorTheme="gray" id="n7" isPressed={isKeyPressed('n7')} onMouseClick={() => handleKeyClick('Digit7')} />
          <Key variant="dualStack" top="8" bottom="*" colorTheme="gray" id="n8" isPressed={isKeyPressed('n8')} onMouseClick={() => handleKeyClick('Digit8')} />
          <Key variant="dualStack" top="9" bottom="(" id="n9" isPressed={isKeyPressed('n9')} onMouseClick={() => handleKeyClick('Digit9')} />
          <Key variant="dualStack" top="0" bottom=")" id="n0" isPressed={isKeyPressed('n0')} onMouseClick={() => handleKeyClick('Digit0')} />
          <Key variant="dualStack" top="-" bottom="—" id="mn" isPressed={isKeyPressed('mn')} onMouseClick={() => handleKeyClick('Minus')} />
          <Key variant="dualStack" top="=" bottom="+" id="eq" isPressed={isKeyPressed('eq')} onMouseClick={() => handleKeyClick('Equal')} />
          <Key variant="single" label="← backspace" width="fill" id="backspace" isPressed={isKeyPressed('backspace')} onMouseClick={() => handleKeyClick('Backspace')} />
          <Key variant="single" label="☀" />
        </div>

        {/* Row 2: QWERTY row */}
        <div className="keyboard-row">
          <Key variant="single" label="tab⇥" width={81} id="tab" isPressed={isKeyPressed('tab')} onMouseClick={() => handleKeyClick('Tab')} />
          <Key variant="dualPos" primary="Q" secondary="/" id="kq" isPressed={isKeyPressed('kq')} onMouseClick={() => handleKeyClick('KeyQ')} />
          <Key variant="dualPos" primary="W" secondary="'" id="kw" isPressed={isKeyPressed('kw')} onMouseClick={() => handleKeyClick('KeyW')} />
          <Key variant="dualPos" primary="E" secondary="ק" id="ke" isPressed={isKeyPressed('ke')} onMouseClick={() => handleKeyClick('KeyE')} />
          <Key variant="dualPos" primary="R" secondary="ר" id="kr" isPressed={isKeyPressed('kr')} onMouseClick={() => handleKeyClick('KeyR')} />
          <Key variant="dualPos" primary="T" secondary="א" id="kt" isPressed={isKeyPressed('kt')} onMouseClick={() => handleKeyClick('KeyT')} />
          <Key variant="dualPos" primary="Y" secondary="ט" id="ky" isPressed={isKeyPressed('ky')} onMouseClick={() => handleKeyClick('KeyY')} />
          <Key variant="dualPos" primary="U" secondary="ו" id="ku" isPressed={isKeyPressed('ku')} onMouseClick={() => handleKeyClick('KeyU')} />
          <Key variant="dualPos" primary="I" secondary="ן" id="ki" isPressed={isKeyPressed('ki')} onMouseClick={() => handleKeyClick('KeyI')} />
          <Key variant="dualPos" primary="O" secondary="ם" id="ko" isPressed={isKeyPressed('ko')} onMouseClick={() => handleKeyClick('KeyO')} />
          <Key variant="dualPos" primary="P" secondary="פ" id="kp" isPressed={isKeyPressed('kp')} onMouseClick={() => handleKeyClick('KeyP')} />
          <Key variant="dualStack" top="{" bottom="[" id="lb" isPressed={isKeyPressed('lb')} onMouseClick={() => handleKeyClick('BracketLeft')} />
          <Key variant="dualStack" top="}" bottom="]" id="rb" isPressed={isKeyPressed('rb')} onMouseClick={() => handleKeyClick('BracketRight')} />
          <Key variant="dualStack" top="|" bottom="\" width="fill" colorTheme="gray" id="bs" isPressed={isKeyPressed('bs')} onMouseClick={() => handleKeyClick('Backslash')} />
          <Key variant="single" label="home" />
        </div>

        {/* Row 3: ASDF row */}
        <div className="keyboard-row">
          <Key variant="single" label="caps lock" width={95} onMouseClick={() => handleKeyClick('CapsLock')} />
          <Key variant="dualPos" primary="A" secondary="ש" id="ka" isPressed={isKeyPressed('ka')} onMouseClick={() => handleKeyClick('KeyA')} />
          <Key variant="dualPos" primary="S" secondary="ד" id="ks" isPressed={isKeyPressed('ks')} onMouseClick={() => handleKeyClick('KeyS')} />
          <Key variant="dualPos" primary="D" secondary="ג" id="kd" isPressed={isKeyPressed('kd')} onMouseClick={() => handleKeyClick('KeyD')} />
          <Key variant="dualPos" primary="F" secondary="כ" id="kf" isPressed={isKeyPressed('kf')} onMouseClick={() => handleKeyClick('KeyF')} />
          <Key variant="dualPos" primary="G" secondary="ע" id="kg" isPressed={isKeyPressed('kg')} onMouseClick={() => handleKeyClick('KeyG')} />
          <Key variant="dualPos" primary="H" secondary="י" id="kh" isPressed={isKeyPressed('kh')} onMouseClick={() => handleKeyClick('KeyH')} />
          <Key variant="dualPos" primary="J" secondary="ח" id="kj" isPressed={isKeyPressed('kj')} onMouseClick={() => handleKeyClick('KeyJ')} />
          <Key variant="dualPos" primary="K" secondary="ל" id="kk" isPressed={isKeyPressed('kk')} onMouseClick={() => handleKeyClick('KeyK')} />
          <Key variant="dualPos" primary="L" secondary="ך" id="kl" isPressed={isKeyPressed('kl')} onMouseClick={() => handleKeyClick('KeyL')} />
          <Key variant="dualPos" primary=":" secondary="ף" id="semi" isPressed={isKeyPressed('semi')} onMouseClick={() => handleKeyClick('Semicolon')} />
          <Key variant="dualPos" primary="&quot;" secondary="," id="quot" isPressed={isKeyPressed('quot')} onMouseClick={() => handleKeyClick('Quote')} />
          <Key variant="single" label="← enter" colorTheme="red" width="fill" id="enter" isPressed={isKeyPressed('enter')} onMouseClick={() => handleKeyClick('Enter')} />
          <Key variant="single" label="pgup" />
        </div>

        {/* Row 4: ZXCV row */}
        <div className="keyboard-row">
          <Key variant="single" label="⇧ shift" width="fill" id="lshift" isPressed={isKeyPressed('lshift')} onMouseClick={() => handleKeyClick('ShiftLeft')} onDoubleClick={() => handleModifierDoubleClick('ShiftLeft')} className={modifierClass('ShiftLeft')} />
          <Key variant="dualPos" primary="Z" secondary="ז" id="kz" isPressed={isKeyPressed('kz')} onMouseClick={() => handleKeyClick('KeyZ')} />
          <Key variant="dualPos" primary="X" secondary="ס" id="kx" isPressed={isKeyPressed('kx')} onMouseClick={() => handleKeyClick('KeyX')} />
          <Key variant="dualPos" primary="C" secondary="ב" id="kc" isPressed={isKeyPressed('kc')} onMouseClick={() => handleKeyClick('KeyC')} />
          <Key variant="dualPos" primary="V" secondary="ה" id="kv" isPressed={isKeyPressed('kv')} onMouseClick={() => handleKeyClick('KeyV')} />
          <Key variant="dualPos" primary="B" secondary="נ" id="kb" isPressed={isKeyPressed('kb')} onMouseClick={() => handleKeyClick('KeyB')} />
          <Key variant="dualPos" primary="N" secondary="מ" id="kn" isPressed={isKeyPressed('kn')} onMouseClick={() => handleKeyClick('KeyN')} />
          <Key variant="dualPos" primary="M" secondary="צ" id="km" isPressed={isKeyPressed('km')} onMouseClick={() => handleKeyClick('KeyM')} />
          <Key variant="dualPos" primary="<" secondary="ת" id="comma" isPressed={isKeyPressed('comma')} onMouseClick={() => handleKeyClick('Comma')} />
          <Key variant="dualPos" primary=">" secondary="ץ" id="dot" isPressed={isKeyPressed('dot')} onMouseClick={() => handleKeyClick('Period')} />
          <Key variant="dualPos" primary="?" secondary="." id="slash" isPressed={isKeyPressed('slash')} onMouseClick={() => handleKeyClick('Slash')} />
          <Key variant="single" label="⇧ shift" width={95} id="rshift" isPressed={isKeyPressed('rshift')} onMouseClick={() => handleKeyClick('ShiftRight')} onDoubleClick={() => handleModifierDoubleClick('ShiftRight')} className={modifierClass('ShiftRight')} />
          <Key variant="icon" iconName="chevron-up" onMouseClick={() => handleKeyClick('ArrowUp')} />
          <Key variant="single" label="pgdn" />
        </div>

        {/* Row 5: Bottom row */}
        <div className="keyboard-row">
          <Key variant="single" label="control" width={68} onMouseClick={() => handleKeyClick('ControlLeft')} onDoubleClick={() => handleModifierDoubleClick('ControlLeft')} className={modifierClass('ControlLeft')} />
          <Key variant="single" label="option" width={68} onMouseClick={() => handleKeyClick('Alt')} onDoubleClick={() => handleModifierDoubleClick('Alt')} className={modifierClass('Alt')} />
          <Key variant="icon" iconName="command" width={68} colorTheme="gray" onMouseClick={() => handleKeyClick('MetaLeft')} onDoubleClick={() => handleModifierDoubleClick('MetaLeft')} className={modifierClass('MetaLeft')} />
          <Key variant="single" label="" width="fill" id="space" isPressed={isKeyPressed('space')} onMouseClick={() => handleKeyClick('Space')} />
          <Key variant="icon" iconName="command" colorTheme="gray" onMouseClick={() => handleKeyClick('MetaRight')} onDoubleClick={() => handleModifierDoubleClick('MetaRight')} className={modifierClass('MetaRight')} />
          <Key variant="single" label="fn1" />
          <Key variant="single" label="fn2" />
          <Key variant="icon" iconName="chevron-left" onMouseClick={() => handleKeyClick('ArrowLeft')} />
          <Key variant="icon" iconName="chevron-down" onMouseClick={() => handleKeyClick('ArrowDown')} />
          <Key variant="icon" iconName="chevron-right" onMouseClick={() => handleKeyClick('ArrowRight')} />
        </div>
      </div>
    </TrainerKeyboardProvider>
  );
};
