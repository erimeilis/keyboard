import React from 'react';
import { Key } from './Key';
import './Keyboard.css';

export const Keyboard: React.FC = () => {
  return (
    <div className="keyboard">
      {/* Row 1: Number row */}
      <div className="keyboard-row">
        <Key variant="single" label="esc" colorTheme="red" />
        <Key variant="dualStack" top="1" bottom="!" />
        <Key variant="dualStack" top="2" bottom="@" />
        <Key variant="dualStack" top="3" bottom="#" />
        <Key variant="dualStack" top="4" bottom="$" />
        <Key variant="dualStack" top="5" bottom="%" colorTheme="gray" />
        <Key variant="dualStack" top="6" bottom="^" colorTheme="gray" />
        <Key variant="dualStack" top="7" bottom="&" colorTheme="gray" />
        <Key variant="dualStack" top="8" bottom="*" colorTheme="gray" />
        <Key variant="dualStack" top="9" bottom="(" />
        <Key variant="dualStack" top="0" bottom=")" />
        <Key variant="dualStack" top="-" bottom="—" />
        <Key variant="dualStack" top="=" bottom="+" />
        <Key variant="single" label="← backspace" width="fill" />
        <Key variant="single" label="☀" />
      </div>

      {/* Row 2: QWERTY row */}
      <div className="keyboard-row">
        <Key variant="single" label="tab⇥" width={81} />
        <Key variant="dualPos" primary="Q" secondary="/" />
        <Key variant="dualPos" primary="W" secondary="'" />
        <Key variant="dualPos" primary="E" secondary="ק" />
        <Key variant="dualPos" primary="R" secondary="ר" />
        <Key variant="dualPos" primary="T" secondary="א" />
        <Key variant="dualPos" primary="Y" secondary="ט" />
        <Key variant="dualPos" primary="U" secondary="ו" />
        <Key variant="dualPos" primary="I" secondary="ן" />
        <Key variant="dualPos" primary="O" secondary="ם" />
        <Key variant="dualPos" primary="P" secondary="פ" />
        <Key variant="dualStack" top="{" bottom="[" />
        <Key variant="dualStack" top="}" bottom="]" />
        <Key variant="dualStack" top="|" bottom="\" width="fill" colorTheme="gray" />
        <Key variant="single" label="home" />
      </div>

      {/* Row 3: ASDF row */}
      <div className="keyboard-row">
        <Key variant="single" label="caps lock" width={95} />
        <Key variant="dualPos" primary="A" secondary="ש" />
        <Key variant="dualPos" primary="S" secondary="ד" />
        <Key variant="dualPos" primary="D" secondary="ג" />
        <Key variant="dualPos" primary="F" secondary="כ" />
        <Key variant="dualPos" primary="G" secondary="ע" />
        <Key variant="dualPos" primary="H" secondary="י" />
        <Key variant="dualPos" primary="J" secondary="ח" />
        <Key variant="dualPos" primary="K" secondary="ל" />
        <Key variant="dualPos" primary="L" secondary="ך" />
        <Key variant="dualPos" primary=":" secondary="ף" />
        <Key variant="dualPos" primary="&quot;" secondary="," />
        <Key variant="single" label="← enter" colorTheme="red" width="fill" />
        <Key variant="single" label="pgup" />
      </div>

      {/* Row 4: ZXCV row */}
      <div className="keyboard-row">
        <Key variant="single" label="⇧ shift" width="fill" />
        <Key variant="dualPos" primary="Z" secondary="ז" />
        <Key variant="dualPos" primary="X" secondary="ס" />
        <Key variant="dualPos" primary="C" secondary="ב" />
        <Key variant="dualPos" primary="V" secondary="ה" />
        <Key variant="dualPos" primary="B" secondary="נ" />
        <Key variant="dualPos" primary="N" secondary="מ" />
        <Key variant="dualPos" primary="M" secondary="צ" />
        <Key variant="dualPos" primary="<" secondary="ת" />
        <Key variant="dualPos" primary=">" secondary="ץ" />
        <Key variant="dualPos" primary="?" secondary="." />
        <Key variant="single" label="⇧ shift" width={95} />
        <Key variant="icon" iconName="chevron-up" />
        <Key variant="single" label="pgdn" />
      </div>

      {/* Row 5: Bottom row */}
      <div className="keyboard-row">
        <Key variant="single" label="control" width={68} />
        <Key variant="single" label="option" width={68} />
        <Key variant="icon" iconName="command" width={68} colorTheme="gray" />
        <Key variant="single" label="" width="fill" />
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
