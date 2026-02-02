import React from 'react';
import './Keyboard.css';

export interface KeySingleProps {
  variant: 'single';
  label: string;
  width?: number | 'fill';
  className?: string;
  colorTheme?: 'black' | 'gray' | 'red';
}

export interface KeyDualStackProps {
  variant: 'dualStack';
  top: string;
  bottom: string;
  width?: number | 'fill';
  className?: string;
  colorTheme?: 'black' | 'gray' | 'red';
}

export interface KeyDualPosProps {
  variant: 'dualPos';
  primary: string;
  secondary: string;
  width?: number | 'fill';
  className?: string;
  colorTheme?: 'black' | 'gray' | 'red';
}

export interface KeyIconProps {
  variant: 'icon';
  iconName: string;
  width?: number | 'fill';
  className?: string;
  colorTheme?: 'black' | 'gray' | 'red';
}

export type KeyProps = KeySingleProps | KeyDualStackProps | KeyDualPosProps | KeyIconProps;

export const Key: React.FC<KeyProps> = (props) => {
  const { width = 54, className = '', colorTheme = 'black' } = props;

  const widthStyle = width === 'fill' ? '100%' : `${width}px`;

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
      className={`key ${getThemeClass()} key-variant-${props.variant} ${className}`}
      style={{ width: widthStyle }}
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
