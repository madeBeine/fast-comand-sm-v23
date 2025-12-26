
import React from 'react';

interface LogoProps {
    className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "w-12 h-12" }) => {
    return (
        <svg 
            viewBox="0 0 100 100" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg" 
            className={className}
        >
            {/* Main Spine and Top Bar (Blue) */}
            <path 
                d="M20 20C20 12 28 8 36 8H85C92 8 92 18 85 20H45V38H75C82 38 82 48 75 50H45V80C45 88 35 90 28 85C22 80 20 75 20 65V20Z" 
                fill="#1D4ED8" // Primary Blue
                className="dark:fill-blue-500"
            />
            
            {/* Dynamic Swoosh / Wing (Orange) */}
            <path 
                d="M45 50H75C85 50 90 60 85 70C80 80 65 92 50 92C35 92 28 85 28 85C35 90 45 88 45 80V50Z" 
                fill="#F59E0B" // Secondary Orange
                className="dark:fill-amber-500"
                fillOpacity="0.9"
            />
            
            {/* Speed Accent */}
            <path 
                d="M15 30C12 30 10 32 10 35V65C10 75 18 85 25 88C15 80 12 65 12 50V35C12 32 14 30 15 30Z" 
                fill="#F59E0B" 
                className="dark:fill-amber-500"
            />
        </svg>
    );
};

export default Logo;
