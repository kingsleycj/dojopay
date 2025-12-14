'use client';

interface HistogramChartProps {
    data: Array<{ label: string; value: number }>;
    color?: string;
    height?: number;
}

export const HistogramChart = ({ data, color = '#8B5CF6', height = 300 }: HistogramChartProps) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const yAxisMax = Math.max(maxValue, 10); // Ensure minimum range of 1-10
    
    return (
        <div className="w-full" style={{ height: `${height}px` }}>
            <div className="flex items-end justify-between h-full gap-1">
                {data.map((item, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                        <div 
                            className="w-full bg-purple-500 rounded-t transition-all duration-300 hover:opacity-80"
                            style={{ 
                                height: `${(item.value / yAxisMax) * (height - 40)}px`,
                                backgroundColor: color
                            }}
                        />
                        <div className="text-xs text-gray-600 mt-2 text-center truncate w-full">
                            {item.label}
                        </div>
                        <div className="text-xs font-semibold text-gray-800">
                            {item.value}
                        </div>
                    </div>
                ))}
            </div>
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -ml-8">
                <span>{yAxisMax}</span>
                <span>{Math.round(yAxisMax / 2)}</span>
                <span>0</span>
            </div>
        </div>
    );
};
