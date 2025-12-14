'use client';

interface ChartProps {
    data: Array<{ label: string; value: number }>;
    color?: string;
    height?: number;
}

export const BarChart = ({ data, color = '#8B5CF6', height = 200 }: ChartProps) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    
    return (
        <div className="w-full" style={{ height: `${height}px` }}>
            <div className="flex items-end justify-between h-full gap-2">
                {data.map((item, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                        <div 
                            className="w-full bg-purple-500 rounded-t transition-all duration-300 hover:opacity-80"
                            style={{ 
                                height: `${(item.value / maxValue) * (height - 30)}px`,
                                backgroundColor: color
                            }}
                        />
                        <div className="text-xs text-gray-600 mt-1 text-center truncate w-full">
                            {item.label}
                        </div>
                        <div className="text-xs font-semibold text-gray-800">
                            {item.value}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const LineChart = ({ data, color = '#10B981', height = 200 }: ChartProps) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const points = data.map((item, index) => {
        const x = (index / (data.length - 1)) * 100;
        const y = 100 - (item.value / maxValue) * 80;
        return `${x},${y}`;
    }).join(' ');
    
    return (
        <div className="w-full relative" style={{ height: `${height}px` }}>
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                />
                {data.map((item, index) => {
                    const x = (index / (data.length - 1)) * 100;
                    const y = 100 - (item.value / maxValue) * 80;
                    return (
                        <circle
                            key={index}
                            cx={x}
                            cy={y}
                            r="2"
                            fill={color}
                        />
                    );
                })}
            </svg>
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
                {data.map((item, index) => (
                    <div key={index} className="text-xs text-gray-600 text-center truncate" style={{ width: `${100 / data.length}%` }}>
                        {item.label}
                    </div>
                ))}
            </div>
        </div>
    );
};
