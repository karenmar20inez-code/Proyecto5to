import React from 'react';

// Paleta: verde (primario), #daccaf (secundario), #ffffff (acento)
const Loader = () => {
  return (
    <div className="w-32 h-32 relative flex items-center justify-center">
      <div className="absolute inset-0 rounded-xl bg-[#2e8b57]/30 blur-xl animate-pulse" />
      <div className="w-full h-full relative flex items-center justify-center">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#2e8b57] via-[#daccaf] to-white animate-spin blur-sm" />
        <div className="absolute inset-1 bg-[#0b2a1d]/80 backdrop-blur-xl border border-[#daccaf]/30 rounded-lg flex items-center justify-center overflow-hidden">
          <div className="flex gap-1 items-center">
            <div className="w-1.5 h-12 bg-[#2e8b57] rounded-full animate-[bounce_1s_ease-in-out_infinite]" />
            <div className="w-1.5 h-12 bg-[#7fc99b] rounded-full animate-[bounce_1s_ease-in-out_infinite_0.1s]" />
            <div className="w-1.5 h-12 bg-[#daccaf] rounded-full animate-[bounce_1s_ease-in-out_infinite_0.2s]" />
            <div className="w-1.5 h-12 bg-white rounded-full animate-[bounce_1s_ease-in-out_infinite_0.3s]" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-transparent animate-pulse" />
        </div>
      </div>
      <div className="absolute -top-1 -left-1 w-2 h-2 bg-[#2e8b57] rounded-full animate-ping" />
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#daccaf] rounded-full animate-ping delay-100" />
      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-[#daccaf] rounded-full animate-ping delay-200" />
      <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping delay-300" />
    </div>
  );
}

export default Loader;
