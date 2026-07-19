import React from 'react';
import './Keyboard.css';
import { useTrainerKeyView } from '../trainer/components/TrainerKeyboardContext';

interface BaseKeyProps {
  width?: number | 'fill';
  className?: string;
  colorTheme?: 'black' | 'gray' | 'red';
  isPressed?: boolean;
  onMouseClick?: () => void;
  onDoubleClick?: () => void;
  id?: string;
}

export interface KeySingleProps extends BaseKeyProps {
  variant: 'single';
  label: string;
}

export interface KeyDualStackProps extends BaseKeyProps {
  variant: 'dualStack';
  top: string;
  bottom: string;
}

export interface KeyDualPosProps extends BaseKeyProps {
  variant: 'dualPos';
  primary: string;
  secondary: string;
}

export interface KeyIconProps extends BaseKeyProps {
  variant: 'icon';
  iconName: string;
}

export type KeyProps = KeySingleProps | KeyDualStackProps | KeyDualPosProps | KeyIconProps;

export const Key: React.FC<KeyProps> = (props) => {
  const {
    width = 54,
    className = '',
    colorTheme = 'black',
    isPressed = false,
    onMouseClick,
    onDoubleClick
  } = props;

  const widthStyle = width === 'fill' ? undefined : `${width}px`;
  const flexStyle = width === 'fill' ? { flexGrow: 1, flexShrink: 1, flexBasis: 0 } : {};

  const trainerView = useTrainerKeyView(props.id);
  const trainerClass = trainerView
    ? [
        trainerView.isNextTarget ? 'key-next-target' : '',
        trainerView.finger ? `key-finger-${trainerView.finger}` : '',
        trainerView.dim ? 'key-dim' : '',
        trainerView.hidden ? 'key-hidden' : '',
        trainerView.fault ? 'key-fault' : '',
      ].filter(Boolean).join(' ')
    : '';
  const trainerStyle = trainerView?.heat != null
    ? ({ ['--key-heat' as any]: String(trainerView.heat) })
    : {};

  const getThemeClass = () => {
    switch (colorTheme) {
      case 'red':
        return 'key-theme-red';
      case 'gray':
        return 'key-theme-gray';
      default:
        return 'key-theme-black';
    }
  };

  const handleClick = () => {
    if (onMouseClick) {
      onMouseClick();
    }
  };

  const renderContent = () => {
    switch (props.variant) {
      case 'single':
        return (
          <div className="key-label-single">
            {props.label}
          </div>
        );

      case 'dualStack':
        return (
          <>
            <div className="key-label-top">
              {props.top}
            </div>
            <div className="key-label-bottom">
              {props.bottom}
            </div>
          </>
        );

      case 'dualPos':
        return (
          <>
            <div className="key-label-primary">
              {props.primary}
            </div>
            <div className="key-label-secondary">
              {props.secondary}
            </div>
          </>
        );

      case 'icon':
        return (
          <svg className="key-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {getIconPath(props.iconName)}
          </svg>
        );
    }
  };

  return (
    <div
      className={`key ${getThemeClass()} key-variant-${props.variant} ${isPressed ? 'key-pressed' : ''} ${trainerClass} ${className}`}
      style={{ width: widthStyle, ...flexStyle, ...trainerStyle }}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
    >
      {renderContent()}
    </div>
  );
};

// Icon paths (using Lucide icons)
function getIconPath(iconName: string): React.ReactNode {
  switch (iconName) {
    case 'chevron-up':
      return <polyline points="18 15 12 9 6 15" />;
    case 'chevron-down':
      return <polyline points="6 9 12 15 18 9" />;
    case 'chevron-left':
      return <polyline points="15 18 9 12 15 6" />;
    case 'chevron-right':
      return <polyline points="9 18 15 12 9 6" />;
    case 'command':
      return (
        <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
      );
    default:
      return null;
  }
}
