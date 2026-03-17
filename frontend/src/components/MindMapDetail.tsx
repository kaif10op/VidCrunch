import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  MarkerType,
  Node,
  Edge,
  Position,
  Connection,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  Handle,
} from "reactflow";
import "reactflow/dist/style.css";
import { 
  Maximize2, 
  Download, 
  Layout, 
  Sparkles, 
  Info, 
  Play, 
  Plus, 
  PlusCircle,
  Undo2,
  ZoomIn,
  ZoomOut,
  Focus,
  X,
  Compass,
  Zap,
  Eye,
  Activity,
  Target,
  RefreshCw
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface MindMapData {
  nodes: { id: string; label: string; details?: string; timestamp?: number }[];
  edges: { id?: string; source: string; target: string; label?: string }[];
}

interface MindMapDetailProps {
  mindMap?: MindMapData;
  onAIAction?: (toolId: string, value: string, context?: string) => void;
  onTimestampClick?: (seconds: number) => void;
  isGenerating?: boolean;
}

// Custom Node Component for a more premium look
const CustomNode = ({ data, selected }: any) => {
  const isPractitioner = data.label.toLowerCase().includes('how') || data.label.toLowerCase().includes('implement');
  const isTheory = data.label.toLowerCase().includes('what') || data.label.toLowerCase().includes('theory') || data.label.toLowerCase().includes('concept');
  
  return (
    <div className={cn(
      "group relative px-6 py-4 rounded-[2.5rem] bg-white border-2 transition-all duration-500 min-w-[220px] shadow-xl",
      selected ? "border-indigo-600 ring-8 ring-indigo-50 shadow-indigo-100" : "border-gray-100 hover:border-indigo-200 shadow-black/5",
      data.isHighlighted && "ring-4 ring-yellow-400 border-yellow-400",
      data.isDimmed && "opacity-30 scale-95"
    )}>
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 !bg-indigo-400 !border-none" />
      
      <div className="flex flex-col gap-1 text-center">
        {data.timestamp !== undefined && (
          <div className="mx-auto bg-indigo-50 text-indigo-600 text-[9px] font-black px-2.5 py-0.5 rounded-full mb-1 uppercase tracking-widest border border-indigo-100">
            {Math.floor(data.timestamp / 60)}:{(data.timestamp % 60).toString().padStart(2, '0')}
          </div>
        )}
        <h3 className={cn(
          "text-sm font-black tracking-tight",
          isTheory ? "text-indigo-900" : isPractitioner ? "text-emerald-900" : "text-gray-900"
        )}>{data.label}</h3>
        {data.details && (
          <p className="text-[10px] text-gray-400 font-medium line-clamp-2 mt-1 leading-normal">{data.details}</p>
        )}
      </div>

      {/* Type Badge */}
      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center">
        {isTheory ? <Info className="h-3 w-3 text-indigo-400" /> : isPractitioner ? <Activity className="h-3 w-3 text-emerald-400" /> : <Zap className="h-3 w-3 text-amber-400" />}
      </div>

      {/* Hover/Selection Actions */}
      <div className={cn(
        "absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 transition-all duration-300 z-[100]",
        (selected || data.isHovered) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        <button 
          onClick={(e) => { e.stopPropagation(); data.onAction('explain', data.label, data.id); }}
          className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-xl hover:bg-indigo-700 hover:scale-110 active:scale-95 transition-all"
          title="Explain Concept"
        >
          <Sparkles className="h-4 w-4" />
        </button>
        {data.timestamp !== undefined && (
          <button 
            onClick={(e) => { e.stopPropagation(); data.onTimestamp(data.timestamp); }}
            className="p-2.5 bg-black text-white rounded-2xl shadow-xl hover:bg-gray-800 hover:scale-110 active:scale-95 transition-all"
            title="Jump to Video"
          >
            <Play className="h-4 w-4 fill-current" />
          </button>
        )}
        <button 
          onClick={(e) => { e.stopPropagation(); data.onAction('expand', data.label, data.id); }}
          className="p-2.5 bg-white text-indigo-600 border-2 border-indigo-50 rounded-2xl shadow-xl hover:bg-indigo-50 hover:scale-110 active:scale-95 transition-all"
          title="Expand Branch"
        >
          <PlusCircle className="h-4 w-4" />
        </button>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 !bg-indigo-400 !border-none" />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

const MindMapInner = ({ mindMap, onAIAction, onTimestampClick, isGenerating }: MindMapDetailProps) => {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const [activeNode, setActiveNode] = useState<any>(null);
  const [explorationMode, setExplorationMode] = useState<'free' | 'focus' | 'trailblazer'>('free');
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);

  const initialNodes = useMemo((): Node[] => {
    if (!mindMap?.nodes?.length) return [];
    
    return mindMap.nodes.map((n, i) => {
        const isRoot = i === 0;
        const row = Math.floor((i + 1) / 3);
        const col = (i + 1) % 3;
        
        let isHighlighted = false;
        let isDimmed = false;

        if (explorationMode === 'focus' && activeNode) {
            const isDirectlyConnected = mindMap.edges.some(e => 
                (e.source === activeNode.id && e.target === n.id) || 
                (e.target === activeNode.id && e.source === n.id)
            );
            isHighlighted = n.id === activeNode.id || isDirectlyConnected;
            isDimmed = !isHighlighted;
        }

        if (explorationMode === 'trailblazer' && activeNode) {
            isHighlighted = highlightedPath.includes(n.id);
            isDimmed = !isHighlighted;
        }

        return {
            id: n.id,
            type: 'custom',
            data: { 
                id: n.id,
                label: n.label, 
                details: n.details,
                timestamp: n.timestamp,
                isHighlighted,
                isDimmed,
                onAction: (type: string, val: string, nodeId: string) => {
                    if (type === 'explain') onAIAction?.('mindmap', `Deeply explain the concept "${val}" and its implications.`, `Node Context: ${val} (ID: ${nodeId})`);
                    if (type === 'expand') onAIAction?.('mindmap_expand', `Expand the mind map branch for "${val}". Provide new granular sub-nodes and edges.`, `Expand Node ID: ${nodeId} | Label: ${val}`);
                },
                onTimestamp: (t: number) => onTimestampClick?.(t)
            },
            position: isRoot ? { x: 0, y: 0 } : { x: (col - 1) * 400, y: (row + 1) * 220 },
        };
    });
  }, [mindMap, onAIAction, onTimestampClick, explorationMode, activeNode, highlightedPath]);

  const initialEdges = useMemo((): Edge[] => {
    if (!mindMap?.edges?.length) return [];
    return mindMap.edges.map((e, i) => {
      const edgeId = e.id || `e-${i}`;
      let isPathHighlighted = false;
      if (explorationMode === 'trailblazer' && highlightedPath.includes(e.source) && highlightedPath.includes(e.target)) {
        isPathHighlighted = true;
      }

      return {
        id: edgeId,
        source: e.source,
        target: e.target,
        label: e.label || "",
        style: { 
          stroke: isPathHighlighted ? "#6366f1" : "#e2e8f0", 
          strokeWidth: isPathHighlighted ? 4 : 3,
          opacity: (explorationMode !== 'free' && !isPathHighlighted) ? 0.2 : 1
        },
        labelStyle: { fill: "#64748b", fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' },
        markerEnd: { type: MarkerType.ArrowClosed, color: isPathHighlighted ? "#6366f1" : "#cbd5e1", width: 20, height: 20 },
        type: "smoothstep",
        animated: isPathHighlighted || (explorationMode === 'free' && i % 3 === 0),
      };
    });
  }, [mindMap, explorationMode, highlightedPath]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Sync hovered state to nodes
  useEffect(() => {
    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...n.data, isHovered: n.id === hoveredNodeId }
    })));
  }, [hoveredNodeId, setNodes]);

  // Simple path finding for trailblazer
  useEffect(() => {
    if (explorationMode === 'trailblazer' && activeNode && mindMap) {
        const path: string[] = [];
        let curr = activeNode.id;
        path.push(curr);
        
        // Walk back to root
        let safety = 0;
        while (curr !== mindMap.nodes[0].id && safety < 10) {
            const parentEdge = mindMap.edges.find(e => e.target === curr);
            if (parentEdge) {
                curr = parentEdge.source;
                path.push(curr);
            } else break;
            safety++;
        }
        setHighlightedPath(path);
    } else {
        setHighlightedPath([]);
    }
  }, [activeNode, explorationMode, mindMap]);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    if (!activeNode) {
        setTimeout(() => fitView({ duration: 800, padding: 0.2 }), 100);
    }
  }, [initialNodes, initialEdges, fitView, setNodes, setEdges, activeNode]);

  const onConnect = useCallback((params: Connection) => setEdges(eds => addEdge(params, eds)), [setEdges]);

  const handleExport = () => {
    // In a real app, use html-to-image or similar
    alert("Exporting logic would go here (PNG/SVG)");
  };

  return (
    <div className="relative w-full h-full bg-slate-50/30">
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => {
                setActiveNode(node);
                // Force select in Focus mode
                if (explorationMode === 'focus') {
                    setNodes(nds => nds.map(n => ({ ...n, selected: n.id === node.id })));
                }
            }}
            onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
            onNodeMouseLeave={() => setHoveredNodeId(null)}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            className="bg-dot-pattern"
        >
            <Background variant={BackgroundVariant.Dots} gap={32} size={1} color="#e2e8f0" />
            
            <Panel position="top-left" className="m-4 flex flex-col gap-3">
                <div className="p-5 bg-white/90 backdrop-blur-2xl border border-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[2.5rem] max-w-[340px]">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[1.2rem] bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                                <Compass className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-gray-900 leading-tight">Mastery Map</h3>
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-0.5">Knowledge Graph</p>
                            </div>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => onAIAction?.('mindmap_regenerate', '')}
                            disabled={isGenerating}
                            className="h-10 w-10 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"
                            title="Regenerate Mind Map"
                        >
                            <RefreshCw className={cn("h-4 w-4", isGenerating && "animate-spin")} />
                        </Button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-50 rounded-2xl border border-gray-100 mb-4">
                        <button 
                            onClick={() => setExplorationMode('free')}
                            className={cn(
                                "flex flex-col items-center gap-1 py-3 rounded-xl transition-all",
                                explorationMode === 'free' ? "bg-white text-indigo-600 shadow-sm border border-gray-100" : "text-gray-400 hover:text-gray-600"
                            )}
                        >
                            <Eye className="h-4 w-4" />
                            <span className="text-[9px] font-black uppercase tracking-tighter">Free</span>
                        </button>
                        <button 
                            onClick={() => setExplorationMode('focus')}
                            className={cn(
                                "flex flex-col items-center gap-1 py-3 rounded-xl transition-all",
                                explorationMode === 'focus' ? "bg-white text-indigo-600 shadow-sm border border-gray-100" : "text-gray-400 hover:text-gray-600"
                            )}
                        >
                            <Target className="h-4 w-4" />
                            <span className="text-[9px] font-black uppercase tracking-tighter">Focus</span>
                        </button>
                        <button 
                            onClick={() => setExplorationMode('trailblazer')}
                            className={cn(
                                "flex flex-col items-center gap-1 py-3 rounded-xl transition-all",
                                explorationMode === 'trailblazer' ? "bg-white text-indigo-600 shadow-sm border border-gray-100" : "text-gray-400 hover:text-gray-600"
                            )}
                        >
                            <Activity className="h-4 w-4" />
                            <span className="text-[9px] font-black uppercase tracking-tighter">Path</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-[11px] font-black uppercase text-gray-400 px-1">
                            <span className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-amber-400" /> Mastery</span>
                            <span className="text-gray-900">{nodes.length} Concepts</span>
                        </div>
                        <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(nodes.length * 5, 100)}%` }}
                                className="h-full bg-indigo-600 rounded-full" 
                            />
                        </div>
                    </div>
                </div>

                {isGenerating && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-full shadow-2xl shadow-indigo-200 flex items-center gap-3 w-fit"
                    >
                        <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                        <span className="text-xs font-black uppercase tracking-widest">AI Expanding Graph...</span>
                    </motion.div>
                )}
            </Panel>

            <Panel position="bottom-right" className="m-6 flex flex-col gap-3">
                <div className="flex flex-col gap-2 bg-white/80 backdrop-blur-xl p-2 rounded-2xl border border-white shadow-2xl">
                    <Button variant="ghost" size="icon" onClick={() => zoomIn()} className="h-10 w-10 text-gray-600 hover:bg-gray-50">
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => zoomOut()} className="h-10 w-10 text-gray-600 hover:bg-gray-50">
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => fitView()} className="h-10 w-10 text-gray-600 hover:bg-gray-50">
                        <Focus className="h-4 w-4" />
                    </Button>
                </div>
                <Button onClick={handleExport} className="rounded-2xl bg-black hover:bg-gray-800 text-white font-black text-[10px] uppercase tracking-widest h-12 px-6 shadow-xl">
                    <Download className="h-4 w-4 mr-2" /> Export Graph
                </Button>
            </Panel>

            <Panel position="top-right" className="m-4">
               <AnimatePresence>
                {activeNode && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="w-[320px] bg-white/90 backdrop-blur-2xl border border-white shadow-2xl rounded-[2.5rem] overflow-hidden"
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                                    Node Insights
                                </div>
                                <div className="flex items-center gap-1">
                                    {explorationMode === 'focus' && (
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => setExplorationMode('free')}
                                            className="h-8 w-8 rounded-full text-amber-500 hover:bg-amber-50"
                                            title="Clear Focus"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => setActiveNode(null)} className="h-8 w-8 rounded-full">
                                        <X className="h-4 w-4 text-gray-400" />
                                    </Button>
                                </div>
                            </div>
                            <h3 className="text-xl font-black text-gray-900 tracking-tight mb-2 underline decoration-indigo-200 decoration-4 underline-offset-4">{activeNode.data.label}</h3>
                            <p className="text-sm font-medium text-gray-500 leading-relaxed mb-6">
                                {activeNode.data.details || "This concept represents a core pillar of the video's architectural model. Expand to see sub-topics or ask for a cross-concept synthesis."}
                            </p>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <Button 
                                    onClick={() => activeNode.data.onAction('explain', activeNode.data.label)}
                                    className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-black text-[10px] uppercase tracking-widest h-10"
                                >
                                    Explain
                                </Button>
                                <Button 
                                    onClick={() => activeNode.data.onAction('expand', activeNode.data.label)}
                                    variant="outline"
                                    className="rounded-2xl border-indigo-100 text-indigo-600 font-black text-[10px] uppercase tracking-widest h-10"
                                >
                                    Expand
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
               </AnimatePresence>
            </Panel>
        </ReactFlow>
    </div>
  );
};

const MindMapDetail = (props: MindMapDetailProps) => {
  if (!props.mindMap?.nodes?.length) {
    return (
        <div className="w-full h-full min-h-[600px] flex flex-col items-center justify-center bg-slate-50 border border-gray-100 rounded-[3rem] p-12 text-center">
            <div className="w-24 h-24 rounded-[2.5rem] bg-white shadow-2xl flex items-center justify-center mb-8 relative">
                <Compass className="h-10 w-10 text-indigo-600" />
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-indigo-600 border-4 border-white flex items-center justify-center shadow-lg">
                    <Sparkles className="h-3 w-3 text-white" />
                </div>
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-4">Mastery Map Pending</h2>
            <p className="max-w-md text-gray-500 font-medium leading-relaxed mb-10">
                Visualize the conceptual DNA of this video. We'll build an interactive knowledge graph showing how every theory and practical step connects.
            </p>
            <Button 
                onClick={() => props.onAIAction?.('mindmap', 'Generate a comprehensive mind map of this video workflow.')}
                disabled={props.isGenerating}
                className="rounded-[2rem] bg-indigo-600 hover:bg-indigo-700 text-white px-12 h-16 font-black text-base shadow-2xl shadow-indigo-100 flex items-center gap-4 transition-all hover:scale-105 active:scale-95"
            >
                {props.isGenerating ? (
                    <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        Generating Map...
                    </>
                ) : (
                    <>
                        <Zap className="h-6 w-6" />
                        Generate Knowledge Graph
                    </>
                )}
            </Button>
        </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[600px] border border-gray-100 rounded-[3rem] overflow-hidden shadow-sm bg-white">
        <ReactFlowProvider>
            <MindMapInner {...props} />
        </ReactFlowProvider>
    </div>
  );
};

export default MindMapDetail;
