import React from 'react';

export function ClutchLogo({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="10 10 295 70" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
    >
      <defs>
        <linearGradient id="clutch-brand-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#20808D" />
          <stop offset="100%" stopColor="#13565F" />
        </linearGradient>
      </defs>

      {/* C */}
      <path d="M 55 30 L 35 30 A 25 25 0 0 0 35 80 L 55 80 L 55 66 L 35 66 A 11 11 0 0 1 35 44 L 55 44 Z" fill="currentColor" />
      <path d="M 55 30 L 55 44 L 45 44 Z" fill="url(#clutch-brand-grad)" /> 

      {/* L */}
      <path d="M 65 24 A 14 14 0 0 1 79 10 L 79 55 L 65 55 Z" fill="currentColor" />
      <path d="M 65 55 L 79 55 L 79 80 L 65 80 Z" fill="url(#clutch-brand-grad)" />

      {/* U */}
      <path d="M 90 30 L 104 30 L 104 55 L 90 55 Z" fill="currentColor" />
      <path d="M 126 30 L 140 30 L 140 55 L 126 55 Z" fill="currentColor" />
      <path d="M 90 55 L 104 55 A 11 11 0 0 0 126 55 L 140 55 A 25 25 0 0 1 90 55 Z" fill="url(#clutch-brand-grad)" />

      {/* T */}
      <path d="M 160 24 A 14 14 0 0 1 174 10 L 174 80 L 160 80 Z" fill="currentColor" />
      <path d="M 148 30 L 160 30 L 160 44 L 148 44 Z" fill="currentColor" />
      <path d="M 174 30 L 190 30 L 180 44 L 174 44 Z" fill="url(#clutch-brand-grad)" />

      {/* C2 */}
      <path d="M 245 30 L 225 30 A 25 25 0 0 0 225 80 L 245 80 L 245 66 L 225 66 A 11 11 0 0 1 225 44 L 245 44 Z" fill="currentColor" />
      <path d="M 245 30 L 245 44 L 235 44 Z" fill="url(#clutch-brand-grad)" />

      {/* H */}
      <path d="M 255 24 A 14 14 0 0 1 269 10 L 269 80 L 255 80 Z" fill="currentColor" />
      <path d="M 255 44 A 25 25 0 0 1 305 44 L 305 55 L 291 55 L 291 44 A 11 11 0 0 0 269 44 L 269 55 L 255 55 Z" fill="currentColor" />
      <path d="M 291 55 L 305 55 L 305 80 L 291 80 Z" fill="url(#clutch-brand-grad)" />
    </svg>
  );
}
