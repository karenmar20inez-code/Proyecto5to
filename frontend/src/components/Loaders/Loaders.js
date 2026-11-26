import React from 'react';

// Paleta de la nutria: oliva (primario), dorado (secundario), crema (acento)
const Loader = () => {
  return (
    <div className="w-32 h-32 relative flex items-center justify-center">
      <div className="absolute inset-0 rounded-xl bg-[#5F6B35]/30 blur-xl animate-pulse" />
      <div className="w-full h-full relative flex items-center justify-center">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#5F6B35] via-[#D1A86A] to-white animate-spin blur-sm" />
        <div className="absolute inset-1 bg-[color:var(--superficie-solida)] backdrop-blur-xl border border-[#D1A86A]/30 rounded-lg flex items-center justify-center overflow-hidden">
          <div className="flex gap-1 items-center">
            <div className="w-1.5 h-12 bg-[#5F6B35] rounded-full animate-[bounce_1s_ease-in-out_infinite]" />
            <div className="w-1.5 h-12 bg-[#9B9A64] rounded-full animate-[bounce_1s_ease-in-out_infinite_0.1s]" />
            <div className="w-1.5 h-12 bg-[#D1A86A] rounded-full animate-[bounce_1s_ease-in-out_infinite_0.2s]" />
            <div className="w-1.5 h-12 bg-white rounded-full animate-[bounce_1s_ease-in-out_infinite_0.3s]" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-transparent animate-pulse" />
        </div>
      </div>
      <div className="absolute -top-1 -left-1 w-2 h-2 bg-[#5F6B35] rounded-full animate-ping" />
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#D1A86A] rounded-full animate-ping delay-100" />
      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-[#D1A86A] rounded-full animate-ping delay-200" />
      <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping delay-300" />
    </div>
  );
}

export default Loader;
