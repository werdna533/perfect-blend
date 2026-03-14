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

// Mirrors the Observable demo node shape: pack leaf + simulation node datum
type PackDatum = { children?: PackDatum[] } | BubbleRecord;
type SimNode = d3.SimulationNodeDatum & {
  x: number;
  y: number;
  r: number;
  data: PackDatum;
};

export default function BubbleChart({ data, categories, title }: BubbleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<'blended' | 'clustered'>('clustered');
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

  // D3 rendering — mirrors the Observable clustered-bubbles demo exactly
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(tooltipRef.current);

    svg.selectAll('*').remove();

    const legendWidth = 180;
    const chartWidth = Math.max(300, containerWidth - legendWidth - 24);
    const height = Math.max(400, chartWidth * 0.75);

    svg.attr('width', containerWidth).attr('height', height);

    const filteredData = selectedClass
      ? data.filter(d => d.class_name === selectedClass)
      : data;

    if (filteredData.length === 0) return;

    // ── helpers shared by both modes ─────────────────────────────────────────

    const getClass = (d: SimNode) => (d.data as BubbleRecord).class_name;
    const getColor = (d: SimNode) => colorMap.get(getClass(d)) || '#999';

    function attachInteraction(
      // d3.join() returns BaseType | SVGCircleElement; cast at call site
      circles: d3.Selection<SVGCircleElement | d3.BaseType, SimNode, SVGGElement, unknown>,
    ) {
      circles
        .on('mouseover', (event, d) => {
          const rec = d.data as BubbleRecord;
          tooltip.style('opacity', 1).html(
            `<div class="font-medium">${rec.image_name}</div>
             <div class="text-xs">Class: ${rec.class_name}</div>
             <div class="text-xs">Count: ${rec.count}</div>`
          );
          d3.select(event.currentTarget as SVGCircleElement).attr('stroke-width', 2.5);
        })
        .on('mousemove', event => {
          tooltip
            .style('left', event.offsetX + 12 + 'px')
            .style('top', event.offsetY - 10 + 'px');
        })
        .on('mouseout', event => {
          tooltip.style('opacity', 0);
          d3.select(event.currentTarget as SVGCircleElement).attr('stroke-width', 1);
        })
        .on('click', (_event, d) => {
          const cls = getClass(d);
          setSelectedClass(prev => (prev === cls ? null : cls));
        });
    }

    // ── build pack ───────────────────────────────────────────────────────────
    // Clustered: grouped by class so initial positions are already class-local.
    // Blended: flat — all records as direct children, positions fill the canvas.

    const packHierarchyRoot: PackDatum = layoutMode === 'clustered'
      ? {
          children: Array.from(
            d3.group(filteredData, d => d.class_name),
            ([, children]) => ({ children } as PackDatum),
          ),
        }
      : { children: filteredData as unknown as PackDatum[] };

    const maxCount = d3.max(filteredData, d => d.count) || 1;
    const radiusScale = d3.scaleSqrt()
      .domain([1, maxCount])
      .range([4, Math.max(8, Math.min(chartWidth, height) * 0.055)]);

    const packRoot = d3
      .pack<PackDatum>()
      .size([chartWidth, height])
      .padding(1)(
        d3.hierarchy<PackDatum>(packHierarchyRoot)
          .sum(d => ('count' in d ? Math.max((d as BubbleRecord).count, 1) : 0)),
      );

    const nodes = packRoot.leaves() as unknown as SimNode[];

    // Override pack-computed radii with a consistent scale so both modes
    // show identical bubble sizes for the same count value.
    nodes.forEach(node => {
      node.r = radiusScale(Math.max((node.data as BubbleRecord).count, 1));
    });

    // ── forceCluster: exact Observable centroid-pull algorithm ───────────────

    function makeForceCluster() {
      const strength = 0.1;
      let simNodes: SimNode[];

      function centroid(group: SimNode[]) {
        let x = 0, y = 0, z = 0;
        for (const d of group) {
          const k = d.r ** 2;
          x += d.x * k; y += d.y * k; z += k;
        }
        return { x: x / z, y: y / z };
      }

      const force = (alpha: number) => {
        const centroids = d3.rollup(simNodes, centroid, d => getClass(d));
        const l = alpha * strength;
        for (const d of simNodes) {
          const c = centroids.get(getClass(d));
          if (!c) continue;
          d.vx = (d.vx ?? 0) - (d.x - c.x) * l;
          d.vy = (d.vy ?? 0) - (d.y - c.y) * l;
        }
      };
      (force as any).initialize = (n: SimNode[]) => { simNodes = n; };
      return force;
    }

    // ── forceCollide: exact Observable quadtree rigid-collision algorithm ────

    function makeForceCollide() {
      const rigidity = 0.4;   // fixed alpha for greater rigidity
      const padding1  = 2;    // same-class separation
      const padding2  = 6;    // cross-class separation
      let simNodes: SimNode[];
      let maxRadius = 0;

      const force = () => {
        const quadtree = d3.quadtree(simNodes, d => d.x, d => d.y);
        for (const d of simNodes) {
          const r   = d.r + maxRadius;
          const nx1 = d.x - r, ny1 = d.y - r;
          const nx2 = d.x + r, ny2 = d.y + r;

          quadtree.visit((q, x1, y1, x2, y2) => {
            if (!q.length) {
              let leaf = q as d3.QuadtreeLeaf<SimNode>;
              do {
                const other = leaf.data;
                if (other !== d) {
                  const padding = getClass(d) === getClass(other) ? padding1 : padding2;
                  const minDist = d.r + other.r + padding;
                  let dx = d.x - other.x;
                  let dy = d.y - other.y;
                  let dist = Math.hypot(dx, dy);
                  if (dist === 0) { dx = 1e-6; dy = 1e-6; dist = Math.hypot(dx, dy); }
                  if (dist < minDist) {
                    const move = (dist - minDist) / dist * rigidity;
                    d.x -= dx *= move; d.y -= dy *= move;
                    other.x += dx;    other.y += dy;
                  }
                }
              } while ((leaf = (leaf as any).next));
            }
            return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
          });
        }
      };

      (force as any).initialize = (n: SimNode[]) => {
        simNodes = n;
        maxRadius = (d3.max(n, d => d.r) ?? 0) + Math.max(padding1, padding2);
      };
      return force;
    }

    // ── simulation (live — required for drag to work) ────────────────────────

    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('x', d3.forceX(chartWidth / 2).strength(0.01))
      .force('y', d3.forceY(height / 2).strength(0.01))
      .force('cluster', layoutMode === 'clustered' ? makeForceCluster() as any : null)
      .force('collide', makeForceCollide() as any);

    // ── zoom ─────────────────────────────────────────────────────────────────

    const zoomG = svg.append('g').attr('class', 'zoom-g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 8])
      .filter(event => {
        // wheel always zooms; pointer events only zoom on empty svg (not circles)
        if (event.type === 'wheel') return true;
        return !(event.target as Element).closest('circle');
      })
      .on('zoom', event => {
        zoomG.attr('transform', event.transform);
      });

    zoomRef.current = zoom;
    (svg as any).call(zoom);
    // Default zoom level — change 0.8 to any value within scaleExtent [0.25, 8]
    //(svg as any).call(zoom.transform, d3.zoomIdentity.scale(0.6).translate(chartWidth / 2.2, height / 2));

    // ── draw ─────────────────────────────────────────────────────────────────

    const circles = zoomG
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('fill', d => getColor(d))
      .attr('fill-opacity', d => {
        if (!selectedClass) return 0.85;
        return getClass(d) === selectedClass ? 0.85 : 0.15;
      })
      .attr('stroke', d => getColor(d))
      .attr('stroke-width', 1)
      .style('cursor', 'grab');

    // Entry animation with attrTween (exactly like the Observable demo)
    circles
      .transition()
      .delay(() => Math.random() * 500)
      .duration(750)
      .attrTween('r', d => {
        const target = d.r;
        const interp = d3.interpolate(0, target);
        return (t: number) => { d.r = interp(t); return String(d.r); };
      });

    // Drag (exactly like the Observable demo)
    const dragHandler = d3.drag<SVGCircleElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.1).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      });

    circles.call(dragHandler as any);
    attachInteraction(circles);

    simulation.on('tick', () => {
      circles.attr('cx', d => d.x).attr('cy', d => d.y);
    });

    return () => {
      simulation.stop();
      svg.on('.zoom', null);
    };
  }, [data, categories, containerWidth, layoutMode, selectedClass]);

  return (
    <div className="bg-surface border border-border p-6">
      <h3 className="text-lg font-bold text-text mb-4">{title}</h3>

      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLayoutMode('blended')}
          className={`px-3 py-1 text-sm border border-border transition-colors
            ${layoutMode === 'blended'
              ? 'bg-berry/10 font-semibold text-text'
              : 'text-text-muted hover:bg-border/30'
            }`}
        >
          Blended
        </button>
        <button
          onClick={() => setLayoutMode('clustered')}
          className={`px-3 py-1 text-sm border border-border transition-colors
            ${layoutMode === 'clustered'
              ? 'bg-berry/10 font-semibold text-text'
              : 'text-text-muted hover:bg-border/30'
            }`}
        >
            Clustered
          </button>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => { if (zoomRef.current && svgRef.current) d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 1.5); }}
            className="w-7 h-7 flex items-center justify-center border border-border text-text-muted hover:bg-border/30 text-base leading-none"
            title="Zoom in"
          >+</button>
          <button
            onClick={() => { if (zoomRef.current && svgRef.current) d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 1 / 1.5); }}
            className="w-7 h-7 flex items-center justify-center border border-border text-text-muted hover:bg-border/30 text-base leading-none"
            title="Zoom out"
          >−</button>
          <button
            onClick={() => { if (zoomRef.current && svgRef.current) d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.transform, d3.zoomIdentity); }}
            className="px-2 h-7 flex items-center border border-border text-xs text-text-muted hover:bg-border/30"
            title="Reset zoom"
          >Reset</button>
        </div>
      </div>

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
