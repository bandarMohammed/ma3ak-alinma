import React from "react";

interface RiyalSymbolProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

export const RiyalSymbol: React.FC<RiyalSymbolProps> = ({ 
  className = "", 
  size = "1em",
  ...props 
}) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      width={size} 
      height={size} 
      className={`inline-block align-middle fill-current ${className}`}
      style={{ 
        verticalAlign: "-0.15em",
        marginRight: "0.2em",
        marginLeft: "0.2em"
      }}
      {...props}
    >
      {/* Left Pillar + Bottom Curve */}
      <path d="M 38 8 L 46 6.8 L 46 65 L 38 78 L 15 82 L 15 74 L 38 70 Z" />
      {/* Right Pillar */}
      <path d="M 54 15 L 62 13.8 L 62 68 L 54 68 Z" />
      {/* Top Crossbar */}
      <path d="M 18 50 L 81 35 L 81 43 L 18 58 Z" />
      {/* Middle-Right Bar */}
      <path d="M 62 57 L 81 53 L 81 61 L 62 65 Z" />
      {/* Bottom-Right Bar */}
      <path d="M 54 78 L 81 74 L 81 82 L 54 86 Z" />
    </svg>
  );
};
