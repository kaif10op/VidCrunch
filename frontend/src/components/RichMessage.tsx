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
      <div className="h-[300px] w-full bg-gray-50 rounded-2xl border border-gray-100 my-4 overflow-hidden shadow-inner">
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          fitView
          style={{ background: '#f9fafb' }}
        >
          <Background color="#e5e7eb" gap={20} />
          <Controls />
        </ReactFlow>
      </div>
    );
  }

  if (type === 'Chart' || type === 'Graph') {
    const chartType = data.type || 'bar';
    const chartData = data.data || [];
    const colors = ['#000', '#6366f1', '#f59e0b', '#10b981', '#ef4444'];

    return (
      <div className="h-[250px] w-full bg-white rounded-2xl border border-gray-100 p-6 my-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
           {chartType === 'bar' ? <BarChart3 className="h-4 w-4 text-black" /> : <LineChartIcon className="h-4 w-4 text-indigo-500" />}
           <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Data Visualization {data.title ? `— ${data.title}` : ''}
           </span>
        </div>
        <ResponsiveContainer width="100%" height="85%">
          {chartType === 'bar' ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
              />
              <Bar dataKey="value" fill="#000" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#000" strokeWidth={2} dot={{ fill: '#000' }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-xs text-red-500">
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
      <div className="my-4 w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <Table>{children}</Table>
      </div>
    ),
    thead: ({ children }: any) => <TableHeader className="bg-gray-50/50">{children}</TableHeader>,
    tbody: ({ children }: any) => <TableBody>{children}</TableBody>,
    tr: ({ children }: any) => <TableRow className="hover:bg-transparent border-gray-50">{children}</TableRow>,
    th: ({ children }: any) => (
      <TableHead className="h-10 text-[10px] font-black uppercase tracking-widest text-gray-500 py-2">
        {children}
      </TableHead>
    ),
    td: ({ children }: any) => <TableCell className="py-3 text-xs font-medium text-gray-600 leading-relaxed">{children}</TableCell>,
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline ? (
        <div className="relative group my-4">
           <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-white/5 rounded-t-xl">
              <Code2 className="h-3 w-3 text-gray-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                 {match ? match[1] : 'code'}
              </span>
           </div>
           <ScrollArea className="w-full bg-[#1a1b26] rounded-b-xl border border-white/5 max-h-[400px]">
              <pre className="p-4 text-xs font-mono leading-relaxed text-gray-300 overflow-x-auto">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
           </ScrollArea>
        </div>
      ) : (
        <code className="px-1.5 py-0.5 rounded-md bg-gray-100 text-pink-600 font-mono text-[0.8em] font-bold" {...props}>
          {children}
        </code>
      );
    },
    p: ({ children }: any) => <p className="text-sm font-medium leading-[1.8] text-gray-600 mb-4 last:mb-0">{children}</p>,
    ul: ({ children }: any) => <ul className="space-y-2 mb-4 ml-6 list-disc text-gray-400">{children}</ul>,
    li: ({ children }: any) => <li className="text-sm font-medium text-gray-600 leading-relaxed">{children}</li>,
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
