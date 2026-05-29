'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  loadingText?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  icon,
  iconPosition = 'left',
  className = '',
  disabled,
  loadingText,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed relative';

  const sizeStyles = {
    sm: 'h-9 px-4 text-sm',
    md: 'h-12 px-5 text-base',
    lg: 'h-14 px-6 text-lg',
  };

  const variantStyles = {
    primary: 'bg-black text-white hover:bg-zinc-800 focus:ring-zinc-500 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200',
    secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
    outline: 'border border-solid border-black/[.08] bg-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.05]',
    ghost: 'bg-transparent hover:bg-black/[.04] dark:hover:bg-white/[.05]',
  };

  const disabledStyles = 'opacity-50 cursor-not-allowed';
  const widthStyles = fullWidth ? 'w-full' : '';

  // 根据按钮尺寸决定加载动画大小
  const getLoadingSize = () => {
    switch (size) {
      case 'sm': return 20;
      case 'md': return 24;
      case 'lg': return 28;
      default: return 24;
    }
  };

  return (
    <button
      className={`
        ${baseStyles}
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${fullWidth && widthStyles}
        ${disabled || isLoading ? disabledStyles : ''}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          {/* 隐藏原有内容但保持占位 */}
          <span className="invisible">
            {icon && iconPosition === 'left' && icon}
            {children}
            {icon && iconPosition === 'right' && icon}
          </span>
          {/* 显示加载动画 - SVG 自带动画效果 */}
          <div className="absolute inset-0 flex items-center justify-center gap-2">
            <img 
              src="/MaodeLab_LOAD_BTN.svg" 
              alt="Loading" 
              width={getLoadingSize()} 
              height={getLoadingSize()} 
            />
            {loadingText && <span className="text-sm">{loadingText}</span>}
          </div>
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          {children}
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </button>
  );
};

export default Button;