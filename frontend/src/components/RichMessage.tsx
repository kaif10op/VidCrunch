import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Copy, Check, FileText, Brain, Map as MapIcon, 
  BarChart3, Code2, Info, Sparkles, Network,
  LineChart as LineChartIcon, PieChart as PieChartIcon
} from 'lucide-react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

interface RichMessageProps {
  content: string;
  role: 'user' | 'assistant';
  className?: string;
}

/**
 * VisualBlockRenderer handles specialized JSON blocks for visuals.
 * Expected format: [VISUAL:Type] { json_config } [/VISUAL]
 */
const VisualBlockRenderer: React.FC<{ type: string; data: any }> = ({ type, data }) => {
  if (type === 'MindMap' || type === 'Tree') {
    const nodes = data.nodes || [];
    const edges = data.edges || [];
    return (
      <div className="h-[300px] w-full bg-secondary border border-border my-4 overflow-hidden shadow-inner rounded-2xl">
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          fitView
          style={{ background: 'transparent' }}
        >
          <Background color="var(--border)" gap={20} />
          <Controls className="fill-foreground stroke-border" />
        </ReactFlow>
      </div>
    );
  }

  if (type === 'Chart' || type === 'Graph') {
    const chartType = data.type || 'bar';
    const chartData = data.data || [];
    // Using semantic colors: Primary (Indigo/Blue etc), Foreground, and soft variants
    const colors = ['var(--primary)', 'var(--foreground)', 'hsl(var(--muted-foreground))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

    return (
      <div className="h-[250px] w-full bg-card rounded-2xl border border-border p-6 my-4 shadow-sm group">
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-2">
              {chartType === 'bar' ? <BarChart3 className="h-4 w-4 text-primary" /> : <LineChartIcon className="h-4 w-4 text-primary" />}
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                 Data Visualization {data.title ? `— ${data.title}` : ''}
              </span>
           </div>
        </div>
        <ResponsiveContainer width="100%" height="85%">
          {chartType === 'bar' ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} stroke="var(--muted-foreground)" />
              <YAxis fontSize={9} axisLine={false} tickLine={false} stroke="var(--muted-foreground)" />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                itemStyle={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--foreground)' }}
                cursor={{ fill: 'var(--secondary)', opacity: 0.1 }}
              />
              <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} stroke="var(--muted-foreground)" />
              <YAxis fontSize={9} axisLine={false} tickLine={false} stroke="var(--muted-foreground)" />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                itemStyle={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--foreground)' }}
              />
              <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} dot={{ fill: 'var(--primary)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive font-bold flex items-center gap-2">
      <Info className="h-3 w-3" />
      Unknown visual type: {type}
    </div>
  );
};

export const RichMessage: React.FC<RichMessageProps> = ({ content, role, className }) => {
  // Split content by visual blocks
  const parts = useMemo(() => {
    const regex = /\[VISUAL:(\w+)\]([\s\S]*?)\[\/VISUAL\]/g;
    const result = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        result.push({ type: 'text', value: content.slice(lastIndex, match.index) });
      }
      
      // Add the visual match
      try {
        result.push({ 
          type: 'visual', 
          visualType: match[1], 
          data: JSON.parse(match[2].trim()) 
        });
      } catch (e) {
        result.push({ type: 'text', value: `[Error parsing visual: ${match[1]}]` });
      }
      
      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      result.push({ type: 'text', value: content.slice(lastIndex) });
    }

    return result;
  }, [content]);

  const components = useMemo(() => ({
    table: ({ children }: any) => (
      <div className="my-6 w-full overflow-hidden rounded-[24px] border border-border bg-card shadow-sm">
        <Table>{children}</Table>
      </div>
    ),
    thead: ({ children }: any) => <TableHeader className="bg-secondary/50 border-b border-border">{children}</TableHeader>,
    tbody: ({ children }: any) => <TableBody>{children}</TableBody>,
    tr: ({ children }: any) => <TableRow className="hover:bg-secondary/20 border-border transition-colors">{children}</TableRow>,
    th: ({ children }: any) => (
      <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 py-2">
        {children}
      </TableHead>
    ),
    td: ({ children }: any) => <TableCell className="py-4 text-xs font-semibold text-foreground leading-relaxed">{children}</TableCell>,
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline ? (
        <div className="relative group my-6">
           <div className="flex items-center gap-2 px-6 py-2.5 bg-secondary border-b border-border rounded-t-[20px]">
              <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                 {match ? match[1] : 'code snippet'}
              </span>
           </div>
           <ScrollArea className="w-full bg-slate-950 dark:bg-black rounded-b-[20px] border border-border max-h-[500px] shadow-2xl">
              <pre className="p-6 text-xs font-mono leading-relaxed text-slate-300 dark:text-gray-300 overflow-x-auto selection:bg-primary/30">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
           </ScrollArea>
        </div>
      ) : (
        <code className="px-2 py-0.5 rounded-lg bg-secondary text-primary font-mono text-[0.85em] font-bold border border-border" {...props}>
          {children}
        </code>
      );
    },
    p: ({ children }: any) => <p className="text-sm font-medium leading-[1.8] text-foreground/80 mb-4 last:mb-0">{children}</p>,
    ul: ({ children }: any) => <ul className="space-y-2 mb-4 ml-6 list-disc text-muted-foreground">{children}</ul>,
    li: ({ children }: any) => <li className="text-sm font-medium text-foreground/80 leading-relaxed">{children}</li>,
  }), []);

  return (
    <div className={cn("rich-message space-y-2", className)}>
      {parts.map((part, i) => (
        part.type === 'visual' ? (
          <VisualBlockRenderer key={i} type={part.visualType!} data={part.data} />
        ) : (
          <ReactMarkdown 
            key={i} 
            remarkPlugins={[remarkGfm]}
            components={components}
          >
            {part.value!}
          </ReactMarkdown>
        )
      ))}
    </div>
  );
};
