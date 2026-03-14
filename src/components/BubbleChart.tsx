import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { BubbleRecord, CategoryInfo } from '../types';

const CLASS_COLORS = [
  '#FF4040', '#4060FF', '#30C060', '#FFB020', '#E040A0',
  '#8040E0', '#FF8060', '#20D0A0', '#F0E040', '#FF6B6B',
  '#5B8DEF', '#50D080', '#FFC840', '#F060B0', '#A060F0',
  '#FF9080', '#40E0B0', '#F0F060', '#E06040', '#6080FF',
  '#40D070',
];

interface BubbleChartProps {
  data: BubbleRecord[];
  categories: CategoryInfo[];
  title: string;
}

type BubbleHierarchyDatum = { children?: BubbleRecord[] } | BubbleRecord;

export default function BubbleChart({ data, categories, title }: BubbleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  // Prefer the declared category order, then append any classes only present in the data.
  const presentClasses = new Set(data.map(d => d.class_name));
  const classNames = [
    ...categories.map(category => category.name).filter(name => presentClasses.has(name)),
    ...Array.from(presentClasses).filter(name => !categories.some(category => category.name === name)),
  ];
  const colorMap = new Map(classNames.map((name, i) => [name, CLASS_COLORS[i % CLASS_COLORS.length]]));

  // Observe container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleLegendClick = useCallback((className: string) => {
    setSelectedClass(prev => (prev === className ? null : className));
  }, []);

  // D3 rendering
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(tooltipRef.current);

    svg.selectAll('*').remove();

    const legendWidth = 180;
    const chartWidth = Math.max(300, containerWidth - legendWidth - 24);
    const height = Math.max(400, chartWidth * 0.75);

    svg.attr('width', containerWidth).attr('height', height);

    // Filter data if class is selected
    const filteredData = selectedClass
      ? data.filter(d => d.class_name === selectedClass)
      : data;

    if (filteredData.length === 0) return;

    // Build hierarchy
    const root = d3.hierarchy<BubbleHierarchyDatum>({
      children: filteredData,
    })
      .sum(d => ('count' in d ? Math.max(d.count, 1) : 0))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const pack = d3.pack<BubbleHierarchyDatum>()
      .size([chartWidth, height])
      .padding(2);

    const packedRoot = pack(root);
    const leaves = packedRoot.leaves();

    // Draw bubbles
    const nodes = svg
      .append('g')
      .selectAll('circle')
      .data(leaves)
      .join('circle')
      .attr('cx', d => d.x!)
      .attr('cy', d => d.y!)
      .attr('r', 0)
      .attr('fill', d => {
        const rec = d.data as unknown as BubbleRecord;
        return colorMap.get(rec.class_name) || '#999';
      })
      .attr('fill-opacity', d => {
        if (!selectedClass) return 0.85;
        const rec = d.data as unknown as BubbleRecord;
        return rec.class_name === selectedClass ? 0.85 : 0.15;
      })
      .attr('stroke', d => {
        const rec = d.data as unknown as BubbleRecord;
        return colorMap.get(rec.class_name) || '#999';
      })
      .attr('stroke-width', 1)
      .style('cursor', 'pointer');

    // Animate entry
    nodes
      .transition()
      .duration(600)
      .ease(d3.easeCubicOut)
      .attr('r', d => d.r);

    // Hover
    nodes
      .on('mouseover', (event, d) => {
        const rec = d.data as unknown as BubbleRecord;
        tooltip
          .style('opacity', 1)
          .html(
            `<div class="font-medium">${rec.image_name}</div>
             <div class="text-xs">Class: ${rec.class_name}</div>
             <div class="text-xs">Count: ${rec.count}</div>`
          );
        d3.select(event.currentTarget).attr('stroke-width', 2.5);
      })
      .on('mousemove', event => {
        tooltip
          .style('left', event.offsetX + 12 + 'px')
          .style('top', event.offsetY - 10 + 'px');
      })
      .on('mouseout', event => {
        tooltip.style('opacity', 0);
        d3.select(event.currentTarget).attr('stroke-width', 1);
      })
      .on('click', (_event, d) => {
        const rec = d.data as unknown as BubbleRecord;
        setSelectedClass(prev => (prev === rec.class_name ? null : rec.class_name));
      });
  }, [data, containerWidth, selectedClass]);

  return (
    <div className="bg-surface border border-border p-6">
      <h3 className="text-lg font-bold text-text mb-4">{title}</h3>

      <div ref={containerRef} className="flex gap-6">
        {/* Chart area */}
        <div className="flex-1 relative">
          <svg ref={svgRef} />
          <div
            ref={tooltipRef}
            className="absolute pointer-events-none bg-surface border border-border px-3 py-2 text-sm text-text opacity-0 transition-opacity z-10"
            style={{ whiteSpace: 'nowrap' }}
          />
        </div>

        {/* Legend */}
        <div className="w-44 shrink-0">
          <h4 className="text-sm font-semibold text-text-muted mb-2">Classes</h4>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {classNames.map(name => (
              <button
                key={name}
                onClick={() => handleLegendClick(name)}
                className={`flex items-center gap-2 w-full text-left px-2 py-1 text-sm transition-colors
                  ${selectedClass === name
                    ? 'bg-berry/10 font-semibold text-text'
                    : selectedClass
                      ? 'text-text-muted opacity-50'
                      : 'text-text hover:bg-border/30'
                  }`}
              >
                <span
                  className="w-3 h-3 shrink-0"
                  style={{ backgroundColor: colorMap.get(name) }}
                />
                <span className="truncate">{name}</span>
              </button>
            ))}
          </div>
          {selectedClass && (
            <button
              onClick={() => setSelectedClass(null)}
              className="mt-2 text-xs text-berry hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
