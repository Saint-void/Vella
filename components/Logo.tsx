import React from 'react';
import logo from '@/assests/my-logo.png'; // now inside src

export const VoidLogo: React.FC<{ className?: string }> = ({ className = "w-100 h-100" }) => (
  <img src={logo} alt="Void Logo" className={className} />
);

export default VoidLogo;
