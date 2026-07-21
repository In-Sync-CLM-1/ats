import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, ScatterChart, FunnelChart, BarChart, CustomChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  ScatterChart,
  FunnelChart,
  BarChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  SVGRenderer,
]);

// Chart ink & palette — validated ordinal blue ramp + chrome tokens
export const viz = {
  blue: '#2a78d6',
  blueSoft: '#86b6ef',
  ramp4: ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab'],
  ramp5: ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'],
  orange: '#eb6834',
  ink: '#0b0b0b',
  inkSecondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  surface: '#ffffff',
};

export const vizAxisLabel = { color: viz.muted, fontSize: 11 };
export const vizSplitLine = { lineStyle: { color: viz.grid, width: 1 } };
export const vizTooltip = {
  backgroundColor: viz.surface,
  borderColor: viz.grid,
  borderWidth: 1,
  padding: [8, 12],
  textStyle: { color: viz.ink, fontSize: 12 },
  extraCssText: 'box-shadow: 0 4px 16px rgba(11,11,11,0.08); border-radius: 8px;',
};

interface EChartProps {
  option: echarts.EChartsCoreOption;
  height?: number;
}

export function EChart({ option, height = 280 }: EChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: 'svg' });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} style={{ height, width: '100%' }} />;
}
