'use client';

interface ChartProps {
    data: Array<{ label: string; value: number }>;
    color?: string;
    height?: number;
}

export const BarChart = ({ data, color = '#f97316', height = 200 }: ChartProps) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    
    return (
        <div className="w-full" style={{ height: `${height}px` }}>
            <div className="flex items-end justify-between h-full gap-2">
                {data.map((item, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                        <div 
                            className="w-full rounded-t transition-all duration-300 hover:opacity-80"
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

interface DualBarChartProps {
    data: Array<{ label: string; fullLabel?: string; a: number; b: number }>;
    aColor?: string;
    bColor?: string;
    height?: number;
}

export const DualBarChart = ({ data, aColor = '#f97316', bColor = '#111827', height = 220 }: DualBarChartProps) => {
    const maxValue = Math.max(...data.flatMap((d) => [d.a, d.b]), 1);

    return (
        <div className="w-full" style={{ height: `${height}px` }}>
            <div className="flex items-end justify-between h-full gap-2">
                {data.map((item, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center group relative">
                        <div className="w-full flex items-end justify-center gap-1" style={{ height: `${height - 36}px` }}>
                            <div
                                className="w-1/2 rounded-t transition-all duration-300 hover:opacity-90"
                                style={{
                                    height: `${(item.a / maxValue) * (height - 36)}px`,
                                    backgroundColor: aColor
                                }}
                            />
                            <div
                                className="w-1/2 rounded-t transition-all duration-300 hover:opacity-90"
                                style={{
                                    height: `${(item.b / maxValue) * (height - 36)}px`,
                                    backgroundColor: bColor
                                }}
                            />
                        </div>
                        <div className="text-xs text-gray-600 mt-2 text-center truncate w-full">
                            {item.label}
                        </div>
                        
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            <div className="font-semibold">{item.fullLabel || item.label}</div>
                            <div className="flex gap-3 mt-1">
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded" style={{ backgroundColor: aColor }}></div>
                                    <span>Tasks: {item.a}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded" style={{ backgroundColor: bColor }}></div>
                                    <span>Submissions: {item.b}</span>
                                </div>
                            </div>
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const LineChart = ({ data, color = '#111827', height = 200 }: ChartProps) => {
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
