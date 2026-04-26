"use client";

import { useEffect, useRef } from "react";
import { Chart, ChartConfiguration, registerables } from "chart.js";

Chart.register(...registerables);

type ServicesChartProps = {
  data: Record<string, number>;
  title?: string;
};

export function ServicesChart({ data, title }: ServicesChartProps) {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const labels = Object.keys(data);
    const values = Object.values(data);

    // Generate colors
    const colors = [
      "rgba(16, 185, 129, 0.7)",  // emerald
      "rgba(59, 130, 246, 0.7)",  // blue
      "rgba(245, 158, 11, 0.7)",  // amber
      "rgba(239, 68, 68, 0.7)",   // red
      "rgba(139, 92, 246, 0.7)",  // violet
      "rgba(236, 72, 153, 0.7)",  // pink
      "rgba(20, 184, 166, 0.7)",  // teal
    ];

    const config: ChartConfiguration = {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderColor: "white",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              usePointStyle: true,
              font: {
                size: 11,
              },
            },
          },
          title: {
            display: !!title,
            text: title,
          },
        },
      },
    };

    chartInstance.current = new Chart(chartRef.current, config);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, title]);

  return (
    <div className="h-64 w-full">
      <canvas ref={chartRef} />
    </div>
  );
}
