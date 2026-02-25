import React, { useEffect, useState, useRef } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  type: 'kitty';
  timestamp: number;
  kittyImage?: string; // HelloKitty 图片文件名
}

// HelloKitty 动作图片列表
const KITTY_IMAGES = ['hello.png', 'jump.png', 'stand.png', 'think.png'];

/**
 * 鼠标特效组件 - 显示 HelloKitty
 */
const MouseEffects: React.FC = () => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const lastClickTimeRef = useRef<number>(0);

  useEffect(() => {
    // 开发模式下不显示鼠标效果
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    let particleId = 0;

    /**
     * 创建粒子特效
     */
    const createParticle = (x: number, y: number) => {
      // 随机选择一个 HelloKitty 动作图片
      const kittyImage = KITTY_IMAGES[Math.floor(Math.random() * KITTY_IMAGES.length)];
      
      const newParticle: Particle = {
        id: particleId++,
        x,
        y,
        type: 'kitty',
        timestamp: Date.now(),
        kittyImage,
      };
      setParticles((prev) => [...prev, newParticle]);

      // 1.5秒后移除粒子
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => p.id !== newParticle.id));
      }, 1500);
    };

    /**
     * 处理鼠标点击事件
     */
    const handleMouseClick = (e: MouseEvent) => {
      const now = Date.now();
      // 防止在200ms内重复创建 HelloKitty
      if (now - lastClickTimeRef.current < 200) {
        return;
      }
      lastClickTimeRef.current = now;
      
      // 点击时显示 HelloKitty
      createParticle(e.clientX, e.clientY);
    };

    // 添加事件监听器
    window.addEventListener('click', handleMouseClick);

    // 清理函数
    return () => {
      window.removeEventListener('click', handleMouseClick);
    };
  }, []);

  // 开发模式下不渲染任何内容
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 animate-float"
          style={{
            left: `${particle.x}px`,
            top: `${particle.y}px`,
            backgroundColor: 'transparent',
            background: 'transparent',
          }}
        >
          {particle.kittyImage && (
            <img
              src={`${import.meta.env.BASE_URL}images/${particle.kittyImage}`}
              alt="HelloKitty"
              className="w-12 h-12 object-contain"
              style={{ 
                filter: 'drop-shadow(0 0 10px rgba(255, 192, 203, 0.9))',
                imageRendering: 'auto',
                userSelect: 'none',
                pointerEvents: 'none',
                backgroundColor: 'transparent',
                background: 'transparent',
                display: 'block'
              }}
              onError={(e) => {
                // 如果图片加载失败，隐藏图片
                (e.target as HTMLImageElement).style.display = 'none';
                console.error('Failed to load image:', `${import.meta.env.BASE_URL}images/${particle.kittyImage}`);
              }}
            />
          )}
        </div>
      ))}
      <style>{`
        @keyframes float {
          0% {
            transform: translate(-50%, -50%) translateY(0) scale(1) rotate(0deg);
            opacity: 1;
          }
          25% {
            transform: translate(-50%, -50%) translateY(-20px) scale(1.3) rotate(5deg);
            opacity: 0.9;
          }
          50% {
            transform: translate(-50%, -50%) translateY(-40px) scale(1.1) rotate(-5deg);
            opacity: 0.7;
          }
          75% {
            transform: translate(-50%, -50%) translateY(-60px) scale(0.9) rotate(3deg);
            opacity: 0.4;
          }
          100% {
            transform: translate(-50%, -50%) translateY(-80px) scale(0.6) rotate(0deg);
            opacity: 0;
          }
        }
        .animate-float {
          animation: float 1.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default MouseEffects;
