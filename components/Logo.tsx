
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
            {/* Speed Arrows - Abstract Forward Motion */}
            <path 
                d="M20 20L55 50L20 80V20Z" 
                fill="currentColor" 
                className="text-blue-600 dark:text-blue-500"
            />
            <path 
                d="M50 20L85 50L50 80V20Z" 
                fill="currentColor" 
                fillOpacity="0.6"
                className="text-blue-600 dark:text-blue-500"
            />
        </svg>
    );
};

export default Logo;
