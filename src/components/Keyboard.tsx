import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Key } from './Key';
import { mapKeyCodeToComponentId } from '../utils/keyMapping';
import './Keyboard.css';

export const Keyboard: React.FC = () => {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let unlistenPress: (() => void) | undefined;
    let unlistenRelease: (() => void) | undefined;

    // Set up event listeners
    const setupListeners = async () => {
      unlistenPress = await listen<string>('key-pressed', (event) => {
        const componentId = mapKeyCodeToComponentId(event.payload);
        if (componentId) {
          setPressedKeys(prev => new Set(prev).add(componentId));
        }
      });

      unlistenRelease = await listen<string>('key-released', (event) => {
        const componentId = mapKeyCodeToComponentId(event.payload);
        if (componentId) {
          setPressedKeys(prev => {
            const next = new Set(prev);
            next.delete(componentId);
            return next;
          });
        }
      });
    };

    setupListeners();

    // Cleanup
    return () => {
      if (unlistenPress) unlistenPress();
      if (unlistenRelease) unlistenRelease();
    };
  }, []);

  const isKeyPressed = (id: string) => pressedKeys.has(id);

  return (
    <div className="keyboard">
      {/* Row 1: Number row */}
      <div className="keyboard-row">
        <Key variant="single" label="esc" colorTheme="red" isPressed={isKeyPressed('esc')} />
        <Key variant="dualStack" top="1" bottom="!" isPressed={isKeyPressed('n1')} />
        <Key variant="dualStack" top="2" bottom="@" isPressed={isKeyPressed('n2')} />
        <Key variant="dualStack" top="3" bottom="#" isPressed={isKeyPressed('n3')} />
        <Key variant="dualStack" top="4" bottom="$" isPressed={isKeyPressed('n4')} />
        <Key variant="dualStack" top="5" bottom="%" colorTheme="gray" isPressed={isKeyPressed('n5')} />
        <Key variant="dualStack" top="6" bottom="^" colorTheme="gray" isPressed={isKeyPressed('n6')} />
        <Key variant="dualStack" top="7" bottom="&" colorTheme="gray" isPressed={isKeyPressed('n7')} />
        <Key variant="dualStack" top="8" bottom="*" colorTheme="gray" isPressed={isKeyPressed('n8')} />
        <Key variant="dualStack" top="9" bottom="(" isPressed={isKeyPressed('n9')} />
        <Key variant="dualStack" top="0" bottom=")" isPressed={isKeyPressed('n0')} />
        <Key variant="dualStack" top="-" bottom="—" isPressed={isKeyPressed('mn')} />
        <Key variant="dualStack" top="=" bottom="+" isPressed={isKeyPressed('eq')} />
        <Key variant="single" label="← backspace" width="fill" isPressed={isKeyPressed('backspace')} />
        <Key variant="single" label="☀" />
      </div>

      {/* Row 2: QWERTY row */}
      <div className="keyboard-row">
        <Key variant="single" label="tab⇥" width={81} isPressed={isKeyPressed('tab')} />
        <Key variant="dualPos" primary="Q" secondary="/" isPressed={isKeyPressed('kq')} />
        <Key variant="dualPos" primary="W" secondary="'" isPressed={isKeyPressed('kw')} />
        <Key variant="dualPos" primary="E" secondary="ק" isPressed={isKeyPressed('ke')} />
        <Key variant="dualPos" primary="R" secondary="ר" isPressed={isKeyPressed('kr')} />
        <Key variant="dualPos" primary="T" secondary="א" isPressed={isKeyPressed('kt')} />
        <Key variant="dualPos" primary="Y" secondary="ט" isPressed={isKeyPressed('ky')} />
        <Key variant="dualPos" primary="U" secondary="ו" isPressed={isKeyPressed('ku')} />
        <Key variant="dualPos" primary="I" secondary="ן" isPressed={isKeyPressed('ki')} />
        <Key variant="dualPos" primary="O" secondary="ם" isPressed={isKeyPressed('ko')} />
        <Key variant="dualPos" primary="P" secondary="פ" isPressed={isKeyPressed('kp')} />
        <Key variant="dualStack" top="{" bottom="[" isPressed={isKeyPressed('lb')} />
        <Key variant="dualStack" top="}" bottom="]" isPressed={isKeyPressed('rb')} />
        <Key variant="dualStack" top="|" bottom="\" width="fill" colorTheme="gray" isPressed={isKeyPressed('bs')} />
        <Key variant="single" label="home" />
      </div>

      {/* Row 3: ASDF row */}
      <div className="keyboard-row">
        <Key variant="single" label="caps lock" width={95} />
        <Key variant="dualPos" primary="A" secondary="ש" isPressed={isKeyPressed('ka')} />
        <Key variant="dualPos" primary="S" secondary="ד" isPressed={isKeyPressed('ks')} />
        <Key variant="dualPos" primary="D" secondary="ג" isPressed={isKeyPressed('kd')} />
        <Key variant="dualPos" primary="F" secondary="כ" isPressed={isKeyPressed('kf')} />
        <Key variant="dualPos" primary="G" secondary="ע" isPressed={isKeyPressed('kg')} />
        <Key variant="dualPos" primary="H" secondary="י" isPressed={isKeyPressed('kh')} />
        <Key variant="dualPos" primary="J" secondary="ח" isPressed={isKeyPressed('kj')} />
        <Key variant="dualPos" primary="K" secondary="ל" isPressed={isKeyPressed('kk')} />
        <Key variant="dualPos" primary="L" secondary="ך" isPressed={isKeyPressed('kl')} />
        <Key variant="dualPos" primary=":" secondary="ף" isPressed={isKeyPressed('semi')} />
        <Key variant="dualPos" primary="&quot;" secondary="," isPressed={isKeyPressed('quot')} />
        <Key variant="single" label="← enter" colorTheme="red" width="fill" isPressed={isKeyPressed('enter')} />
        <Key variant="single" label="pgup" />
      </div>

      {/* Row 4: ZXCV row */}
      <div className="keyboard-row">
        <Key variant="single" label="⇧ shift" width="fill" isPressed={isKeyPressed('lshift')} />
        <Key variant="dualPos" primary="Z" secondary="ז" isPressed={isKeyPressed('kz')} />
        <Key variant="dualPos" primary="X" secondary="ס" isPressed={isKeyPressed('kx')} />
        <Key variant="dualPos" primary="C" secondary="ב" isPressed={isKeyPressed('kc')} />
        <Key variant="dualPos" primary="V" secondary="ה" isPressed={isKeyPressed('kv')} />
        <Key variant="dualPos" primary="B" secondary="נ" isPressed={isKeyPressed('kb')} />
        <Key variant="dualPos" primary="N" secondary="מ" isPressed={isKeyPressed('kn')} />
        <Key variant="dualPos" primary="M" secondary="צ" isPressed={isKeyPressed('km')} />
        <Key variant="dualPos" primary="<" secondary="ת" isPressed={isKeyPressed('comma')} />
        <Key variant="dualPos" primary=">" secondary="ץ" isPressed={isKeyPressed('dot')} />
        <Key variant="dualPos" primary="?" secondary="." isPressed={isKeyPressed('slash')} />
        <Key variant="single" label="⇧ shift" width={95} isPressed={isKeyPressed('rshift')} />
        <Key variant="icon" iconName="chevron-up" />
        <Key variant="single" label="pgdn" />
      </div>

      {/* Row 5: Bottom row */}
      <div className="keyboard-row">
        <Key variant="single" label="control" width={68} />
        <Key variant="single" label="option" width={68} />
        <Key variant="icon" iconName="command" width={68} colorTheme="gray" />
        <Key variant="single" label="" width="fill" isPressed={isKeyPressed('space')} />
        <Key variant="icon" iconName="command" colorTheme="gray" />
        <Key variant="single" label="fn1" />
        <Key variant="single" label="fn2" />
        <Key variant="icon" iconName="chevron-left" />
        <Key variant="icon" iconName="chevron-down" />
        <Key variant="icon" iconName="chevron-right" />
      </div>
    </div>
  );
};
