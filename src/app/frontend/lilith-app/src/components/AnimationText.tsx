'use client';

import { useEffect, useState } from 'react';

interface AnimationTextProps {
  text: string;
  className?: string;
  delay?: number;      // 延迟启动（毫秒）
  duration?: number;   // 动画时长（毫秒）
  onComplete?: () => void;
}

export const AnimationText: React.FC<AnimationTextProps> = ({
  text,
  className = '',
  delay = 0,
  duration = 700,
  onComplete,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      if (onComplete) {
        const animationTimer = setTimeout(onComplete, duration);
        return () => clearTimeout(animationTimer);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, duration, onComplete]);

  return (
    <div
      className={`${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity ${duration}ms cubic-bezier(0.34, 1.2, 0.64, 1), transform ${duration}ms cubic-bezier(0.34, 1.2, 0.64, 1)`,
      }}
    >
      {text}
    </div>
  );
};

export default AnimationText;