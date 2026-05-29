'use client';

export function LoadingAnimation() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <img 
        src="/MaodeLab_LOAD.svg" 
        alt="Loading" 
        width={120} 
        height={120} 
      />
    </div>
  );
}