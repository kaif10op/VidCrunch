import { useCallback, useMemo } from "react";
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
} from "reactflow";
import "reactflow/dist/style.css";
import { Map } from "lucide-react";

interface MindMapData {
  nodes: { id: string; label: string }[];
  edges: { source: string; target: string; label?: string }[];
}

interface MindMapTabProps {
  mindMap?: MindMapData;
}

const nodeColors = [
  "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1"
];

const MindMapTab = ({ mindMap }: MindMapTabProps) => {
  // Build RF nodes positioned in a radial layout
  const initialNodes = useMemo((): Node[] => {
    if (!mindMap?.nodes?.length) return [];
    
    const total = mindMap.nodes.length;
    const centerX = 400;
    const centerY = 300;
    const radius = 220;

    return mindMap.nodes.map((n, i) => {
      const isCentral = i === 0;
      const angle = ((i - 1) / (total - 1)) * 2 * Math.PI;
      const x = isCentral ? centerX : centerX + radius * Math.cos(angle);
      const y = isCentral ? centerY : centerY + radius * Math.sin(angle);

      return {
        id: n.id,
        data: { label: n.label },
        position: { x, y },
        style: {
          background: isCentral ? "var(--background)" : "var(--secondary)",
          border: `2px solid ${isCentral ? "var(--primary)" : "var(--border)"}`,
          borderRadius: "24px",
          color: "var(--foreground)",
          padding: isCentral ? "15px 25px" : "10px 18px",
          fontSize: isCentral ? "14px" : "12px",
          fontWeight: isCentral ? "900" : "700",
          boxShadow: "0 4px 12px var(--shadow)",
          maxWidth: isCentral ? "220px" : "180px",
          textAlign: "center",
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });
  }, [mindMap]);

  const initialEdges = useMemo((): Edge[] => {
    if (!mindMap?.edges?.length) return [];
    return mindMap.edges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      label: e.label || "",
      style: { stroke: "var(--border)", strokeWidth: 2 },
      labelStyle: { fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 700 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border)" },
      type: "smoothstep",
    }));
  }, [mindMap]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const onConnect = useCallback((params: Connection) => setEdges(eds => addEdge(params, eds)), [setEdges]);

  if (!mindMap?.nodes?.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border">
          <Map className="h-6 w-6 text-muted-foreground/30" />
        </div>
        <p className="text-sm font-semibold text-foreground">Mind map not generated</p>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">Try using "Educational Deep-Dive" mode for a visual mind map.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border border-border shadow-sm" style={{ height: "min(600px, 70vh)", background: "transparent" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        attributionPosition="bottom-right"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border)" />
        <Controls 
          style={{ 
            background: "var(--card)", 
            color: "var(--foreground)",
            border: "1px solid var(--border)", 
            borderRadius: "12px", 
            boxShadow: "0 4px 12px var(--shadow)" 
          }} 
        />
        <MiniMap 
          style={{ 
            background: "var(--card)", 
            border: "1px solid var(--border)", 
            borderRadius: "12px", 
            boxShadow: "0 4px 12px var(--shadow)" 
          }}
          nodeColor={() => "var(--primary)"}
          maskColor="var(--background)"
        />
      </ReactFlow>
    </div>
  );
};

export default MindMapTab;
