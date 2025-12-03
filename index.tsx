import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Minus, Plus, RotateCcw, Loader2 } from 'lucide-react';

// --- Types ---

interface UserData {
  name: { first: string; last: string };
  picture: { large: string };
  dob: { age: number };
  gender: string;
}

interface FamilyNode {
  id: string;
  role: string;
  x: number;
  y: number;
  data: UserData | null;
  placeholderGender: 'male' | 'female';
}

interface Connection {
  id: string;
  p1: string; // Parent 1 ID
  p2: string; // Parent 2 ID
  children: string[]; // Child IDs
}

// --- Configuration ---

const NODE_WIDTH = 260;
const NODE_HEIGHT = 140; // Visual height approximation for layout
const X_GAP = 320;
const Y_GAP = 380;

// Layout definitions relative to "You" at (0,0)
const LAYOUT_DEFINITIONS: (Omit<FamilyNode, 'data' | 'placeholderGender'> & { gender: string })[] = [
  // Generation 0 (You)
  { id: 'you', role: 'You', x: 0, y: 0, gender: 'random' },
  { id: 'spouse', role: 'Spouse', x: X_GAP, y: 0, gender: 'opposite' },
  { id: 'sibling', role: 'Sister', x: -X_GAP, y: 0, gender: 'female' },
  
  // Generation -1 (Parents)
  { id: 'father', role: 'Father', x: -X_GAP/2, y: -Y_GAP, gender: 'male' },
  { id: 'mother', role: 'Mother', x: X_GAP/2, y: -Y_GAP, gender: 'female' },
  { id: 'uncle', role: 'Uncle', x: -X_GAP * 2, y: -Y_GAP, gender: 'male' },
  { id: 'aunt', role: 'Aunt', x: X_GAP * 2, y: -Y_GAP, gender: 'female' },

  // Generation -2 (Grandparents)
  // Paternal (Center above Father and Uncle)
  { id: 'pat_gf', role: 'Paternal Grandfather', x: (-X_GAP/2 + -X_GAP * 2)/2 - X_GAP/2, y: -Y_GAP * 2, gender: 'male' },
  { id: 'pat_gm', role: 'Paternal Grandmother', x: (-X_GAP/2 + -X_GAP * 2)/2 + X_GAP/2, y: -Y_GAP * 2, gender: 'female' },
  
  // Maternal (Center above Mother and Aunt)
  { id: 'mat_gf', role: 'Maternal Grandfather', x: (X_GAP/2 + X_GAP * 2)/2 - X_GAP/2, y: -Y_GAP * 2, gender: 'male' },
  { id: 'mat_gm', role: 'Maternal Grandmother', x: (X_GAP/2 + X_GAP * 2)/2 + X_GAP/2, y: -Y_GAP * 2, gender: 'female' },

  // Generation 1 (Children)
  // Centered below You and Spouse
  { id: 'child1', role: 'Son', x: X_GAP/2 - X_GAP/2, y: Y_GAP, gender: 'male' },
  { id: 'child2', role: 'Daughter', x: X_GAP/2 + X_GAP/2, y: Y_GAP, gender: 'female' },
];

// Relationships to draw lines
const FAMILY_CONNECTIONS: Connection[] = [
  { id: 'pat_grandparents', p1: 'pat_gf', p2: 'pat_gm', children: ['father', 'uncle'] },
  { id: 'mat_grandparents', p1: 'mat_gf', p2: 'mat_gm', children: ['mother', 'aunt'] },
  { id: 'parents', p1: 'father', p2: 'mother', children: ['you', 'sibling'] },
  { id: 'marriage', p1: 'you', p2: 'spouse', children: ['child1', 'child2'] },
];

// --- Helpers ---

const fetchFamilyData = async (): Promise<FamilyNode[]> => {
  try {
    // Fetch a batch of users to cover all nodes with some buffer
    const response = await fetch('https://randomuser.me/api/?results=50&inc=name,picture,dob,gender,nat&nat=us,gb,fr');
    const data = await response.json();
    const users: UserData[] = data.results;

    const maleUsers = users.filter(u => u.gender === 'male');
    const femaleUsers = users.filter(u => u.gender === 'female');
    
    // Assign "You" first to determine spouse gender
    const youUser = users[0];
    const youGender = youUser.gender;
    const spouseGender = youGender === 'male' ? 'female' : 'male';

    // Helper to pop a user
    const popUser = (gender: string) => {
      const list = gender === 'male' ? maleUsers : femaleUsers;
      return list.shift() || users.shift()!; // Fallback
    };

    return LAYOUT_DEFINITIONS.map(def => {
      let assignedUser: UserData;
      
      if (def.id === 'you') {
        assignedUser = youUser;
      } else if (def.id === 'spouse') {
        assignedUser = popUser(spouseGender);
      } else if (def.gender === 'opposite') {
         assignedUser = popUser(spouseGender);
      } else if (def.gender === 'male' || def.gender === 'female') {
        assignedUser = popUser(def.gender);
      } else {
        assignedUser = popUser('male');
      }

      return {
        ...def,
        placeholderGender: def.gender as 'male' | 'female',
        data: assignedUser
      };
    });

  } catch (error) {
    console.error("Failed to fetch family data", error);
    return [];
  }
};

// --- Components ---

const Card = React.memo(({ node, scale }: { node: FamilyNode; scale: number }) => {
  if (!node.data) return null;

  return (
    <div
      className="absolute flex flex-col items-center bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 transition-all duration-300 hover:shadow-[0_20px_40px_rgb(0,0,0,0.2)] hover:scale-105 group cursor-pointer select-none"
      style={{
        width: NODE_WIDTH,
        height: 'auto',
        left: node.x,
        top: node.y,
        transform: `translate(-50%, -50%)`, // Center the node on its coordinate
        padding: '24px',
        zIndex: 10
      }}
    >
      <div className="relative mb-4">
        <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-blue-500 to-indigo-500 shadow-lg">
          <img 
            src={node.data.picture.large} 
            alt={node.data.name.first} 
            className="w-full h-full rounded-full object-cover border-2 border-white bg-slate-200 pointer-events-none"
          />
        </div>
        {node.id === 'you' && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-md border-2 border-white uppercase tracking-wider">
            You
          </div>
        )}
      </div>
      
      <div className="text-center w-full">
        <h3 className="text-slate-800 font-bold text-xl truncate w-full leading-tight mb-1">
          {node.data.name.first} {node.data.name.last}
        </h3>
        <p className="text-blue-600 font-semibold text-sm uppercase tracking-wider mb-2">
          {node.role}
        </p>
        <div className="inline-block bg-slate-100 px-3 py-1 rounded-full">
          <p className="text-slate-500 text-xs font-medium">
            {node.data.dob.age} years old
          </p>
        </div>
      </div>
    </div>
  );
});

const ConnectionPath = React.memo(({ conn, nodes }: { conn: Connection; nodes: FamilyNode[] }) => {
  const p1Node = nodes.find(n => n.id === conn.p1);
  const p2Node = nodes.find(n => n.id === conn.p2);
  
  if (!p1Node || !p2Node) return null;

  // Calculate center point between parents
  const midX = (p1Node.x + p2Node.x) / 2;
  const parentY = p1Node.y; 

  // Path building
  // 1. Line connecting parents
  const pathString = `M ${p1Node.x} ${parentY} L ${p2Node.x} ${parentY}`;
  
  // 2. Line dropping down from midpoint
  const dropHeight = 100;
  const dropY = parentY + dropHeight;
  let childPaths = `M ${midX} ${parentY} L ${midX} ${dropY}`;

  // 3. Lines to children
  conn.children.forEach(childId => {
    const childNode = nodes.find(n => n.id === childId);
    if (childNode) {
      // Orthogonal routing with rounded corners looks professional
      // Draw horizontal line from midX to childX at dropY level, then down to child
      
      childPaths += ` M ${midX} ${dropY} L ${childNode.x} ${dropY} L ${childNode.x} ${childNode.y}`;
    }
  });

  return (
    <g>
      <path 
        d={`${pathString} ${childPaths}`}
        fill="none" 
        stroke="#94a3b8" 
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Joint Indicator */}
      <circle cx={midX} cy={parentY} r="4" fill="#64748b" stroke="white" strokeWidth="2" />
    </g>
  );
});

const App = () => {
  const [nodes, setNodes] = useState<FamilyNode[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Viewport State
  const [view, setView] = useState({ x: 0, y: 0, scale: 0.7 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Initial Data Fetch
  useEffect(() => {
    fetchFamilyData().then(data => {
      setNodes(data);
      setLoading(false);
    });
  }, []);

  // Initial Center
  useEffect(() => {
    // Initial center on mount
    setView({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      scale: 0.7
    });
  }, []);

  // --- Interaction Handlers ---

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Smooth zoom focused on cursor
    e.stopPropagation();
    
    const zoomIntensity = 0.001;
    const delta = -e.deltaY;
    const scaleChange = Math.exp(delta * zoomIntensity);
    const newScale = Math.min(Math.max(0.1, view.scale * scaleChange), 4);
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Calculate cursor position relative to container
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // Apply zoom while keeping cursor fixed relative to content
    // newX = mouse - (mouse - oldX) * (newScale / oldScale)
    const newX = offsetX - (offsetX - view.x) * (newScale / view.scale);
    const newY = offsetY - (offsetY - view.y) * (newScale / view.scale);

    setView({ x: newX, y: newY, scale: newScale });
  }, [view]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    document.body.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    
    setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.body.style.cursor = 'default';
  };

  // Global mouse up to catch drags that leave the window
  useEffect(() => {
    const handleGlobalMouseUp = () => { isDragging.current = false; document.body.style.cursor = 'default'; };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const handleCenter = () => {
    // Center (0,0) of the world to center of screen
    setView({ 
      x: window.innerWidth / 2, 
      y: window.innerHeight / 2, 
      scale: 0.8 
    });
  };

  const handleZoomIn = () => {
    setView(v => ({ 
      ...v, 
      scale: Math.min(v.scale * 1.2, 4),
      // Simple zoom to center of screen for buttons
      x: window.innerWidth/2 - (window.innerWidth/2 - v.x) * 1.2,
      y: window.innerHeight/2 - (window.innerHeight/2 - v.y) * 1.2
    }));
  };

  const handleZoomOut = () => {
    setView(v => ({ 
      ...v, 
      scale: Math.max(v.scale / 1.2, 0.1),
      x: window.innerWidth/2 - (window.innerWidth/2 - v.x) / 1.2,
      y: window.innerHeight/2 - (window.innerHeight/2 - v.y) / 1.2
    }));
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans"
      style={{
        backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)',
        backgroundSize: '24px 24px',
        userSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Canvas Layer */}
      <div 
        className="absolute top-0 left-0 origin-top-left will-change-transform"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`
        }}
      >
        {/* Connections Layer (Behind Cards) */}
        <svg 
          className="absolute overflow-visible top-0 left-0 pointer-events-none" 
          style={{ zIndex: 0 }}
        >
          {FAMILY_CONNECTIONS.map(conn => (
            <ConnectionPath key={conn.id} conn={conn} nodes={nodes} />
          ))}
        </svg>

        {/* Nodes Layer */}
        {nodes.map(node => (
          <Card key={node.id} node={node} scale={view.scale} />
        ))}
      </div>

      {/* HUD Controls */}
      <div className="absolute bottom-8 right-8 flex flex-col gap-2 bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-white/50 z-50">
        <button 
          onClick={handleZoomIn} 
          className="p-3 hover:bg-slate-100 rounded-xl text-slate-700 transition-all hover:scale-110 active:scale-95"
          title="Zoom In"
        >
          <Plus size={20} />
        </button>
        <button 
          onClick={handleZoomOut} 
          className="p-3 hover:bg-slate-100 rounded-xl text-slate-700 transition-all hover:scale-110 active:scale-95"
          title="Zoom Out"
        >
          <Minus size={20} />
        </button>
        <div className="h-px bg-slate-200 my-1 mx-2" />
        <button 
          onClick={handleCenter} 
          className="p-3 hover:bg-blue-50 hover:text-blue-600 rounded-xl text-slate-700 transition-all hover:scale-110 active:scale-95" 
          title="Center View"
        >
          <RotateCcw size={20} />
        </button>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-[100] transition-opacity duration-500">
          <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-3xl shadow-2xl border border-slate-100">
            <Loader2 className="animate-spin text-blue-600" size={48} />
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-800">Generating Family Tree</h2>
              <p className="text-slate-500 mt-1">Tracing genetic lines...</p>
            </div>
          </div>
        </div>
      )}

      {/* Credit / Overlay Info (Optional) */}
      <div className="absolute top-8 left-8 pointer-events-none">
        <h1 className="text-2xl font-bold text-slate-900/80 tracking-tight">Family Tree</h1>
        <p className="text-slate-500 text-sm font-medium">Interactive Visualizer</p>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);