import React from "react";
import './FullWaveform.css';

type FullWaveformProps = {
  colorClass?: string;
  loading?: boolean;      // whether the waveform runs
  statusText?: string;    // text next to animation
  processing?: boolean;   // true if showing "Vella is processing"
};

const FullWaveform: React.FC<FullWaveformProps> = ({
  colorClass = "bg-white",
  loading = false,
  statusText = "Vella is listening",
  processing = false,
}) => {
  return (
    <div className="flex items-center justify-center gap-1.5 h-full w-full">
      {/* Animation */}
      <div className="flex items-center gap-1.5">
        {processing ? (
          // Blinking dots for processing
          [...Array(7)].map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full bg-white animate-blink`}
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))
        ) : (
          // Original waveform for listening
          [...Array(8)].map((_, i) => (
            <div
              key={i}
              className={`waveform-bar ${colorClass} w-2 rounded-full ${
                loading ? "animate-waveform" : ""
              }`}
            />
          ))
        )}
      </div>
      {/* Status text */}
      <span className="text-xs font-bold tracking-widest uppercase opacity-60">
        {statusText}
      </span>
    </div>
  );
};

export default FullWaveform;