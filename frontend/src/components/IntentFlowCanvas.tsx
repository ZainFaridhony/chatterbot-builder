import { FC, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Handle,
  Node,
  Position,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import classNames from 'classnames';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { IntentTreeNode } from '../hooks/useIntents';

const NODE_WIDTH = 260;
const NODE_HEIGHT = 200;
const HORIZONTAL_GAP = 320;
const VERTICAL_GAP = 200;
const RESPONSE_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  image: 'Image',
  api: 'Custom API',
};
const RESPONSE_TYPE_STYLES: Record<string, string> = {
  text: 'bg-sky-100 text-sky-700',
  image: 'bg-violet-100 text-violet-700',
  api: 'bg-amber-100 text-amber-700',
};

type IntentFlowCanvasProps = {
  intents: IntentTreeNode[];
  selectedIntentId: number | null;
  onSelectIntent: (intentId: number | null) => void;
  onCreateFollowUp: (parentId: number) => void;
  onEditIntent: (intentId: number) => void;
  onDeleteIntent: (intentId: number) => void;
  onEditFallback?: (intentId: number) => void;
};

type NodeData = {
  intent: IntentTreeNode;
  selected: boolean;
  onSelect: (intentId: number) => void;
  onCreateFollowUp: (intentId: number) => void;
  onEdit: (intentId: number) => void;
  onDelete: (intentId: number) => void;
  onEditFallback?: (intentId: number) => void;
};

const actionButtonBase =
  'inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400/50';

const IntentNode: FC<{ data: NodeData }> = ({ data }) => {
  const { intent, selected, onSelect, onCreateFollowUp, onEdit, onDelete, onEditFallback } = data;
  const isFallbackIntent = intent.is_fallback;
  const isDefaultWelcome = intent.is_default_welcome;
  const responseTypes = useMemo(() => {
    const types = new Set<string>();
    intent.responses.forEach((response) => {
      if (response.response_type) {
        types.add(response.response_type);
      } else if (response.text) {
        types.add('text');
      }
    });
    return Array.from(types);
  }, [intent.responses]);

  const nodeClass = classNames(
    'flex h-full w-full flex-col rounded-3xl border px-5 py-5 shadow-sm transition duration-200 focus:outline-none',
    {
      'cursor-pointer hover:-translate-y-0.5': true,
      'border-amber-200 bg-amber-50/80 shadow-amber-100': isFallbackIntent,
      'border-neutral-200 bg-white/95 shadow-neutral-100': !isFallbackIntent,
      'ring-2 ring-neutral-900/20 ring-offset-2 ring-offset-white': selected,
    },
  );

  return (
    <div
      className={nodeClass}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(intent.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(intent.id);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-neutral-900">{intent.name}</div>
          {intent.description && (
            <p className="text-xs text-neutral-500 line-clamp-2 break-words">{intent.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {isFallbackIntent && (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Fallback
              </span>
            )}
            <span
              className={classNames('rounded-full px-2 py-0.5 text-xs font-medium', {
                'bg-emerald-100 text-emerald-700': intent.is_active,
                'bg-rose-100 text-rose-700': !intent.is_active,
              })}
            >
              {intent.is_active ? 'Active' : 'Disabled'}
            </span>
          </div>
          {isDefaultWelcome && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Welcome
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
          <span className="font-medium">Training: {intent.training_phrases.length}</span>
          <span className="font-medium">Responses: {intent.responses.length}</span>
          {intent.branches?.length ? <span className="font-medium">Logic: {intent.branches.length}</span> : null}
        </div>
        {intent.fulfillment?.enabled && (
          <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-600">
            Fulfillment Active
          </div>
        )}
        {responseTypes.length > 0 && (
          <div className="flex flex-wrap gap-1 text-[10px] font-semibold uppercase tracking-wide">
            {responseTypes.map((type) => (
              <span
                key={type}
                className={classNames(
                  'rounded-full px-2 py-0.5',
                  RESPONSE_TYPE_STYLES[type] ?? 'bg-neutral-100 text-neutral-600',
                )}
              >
                {RESPONSE_TYPE_LABELS[type] ?? type}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-4 pt-6">
        <div className="group relative">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCreateFollowUp(intent.id);
            }}
            className={actionButtonBase}
            aria-label="Add follow-up intent"
          >
            <FiPlus className="h-4 w-4" />
            <span className="sr-only">Add Intent</span>
          </button>
          <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900 px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-sm transition group-hover:opacity-100">
            Add Intent
          </span>
        </div>
        <div className="group relative">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(intent.id);
            }}
            className={actionButtonBase}
            aria-label="Edit intent"
          >
            <FiEdit2 className="h-4 w-4" />
            <span className="sr-only">Edit Intent</span>
          </button>
          <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900 px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-sm transition group-hover:opacity-100">
            Edit Intent
          </span>
        </div>
        <div className="group relative">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(intent.id);
            }}
            className={classNames(
              actionButtonBase,
              'border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50 focus-visible:outline-rose-400/60',
            )}
            aria-label="Delete intent"
          >
            <FiTrash2 className="h-4 w-4" />
            <span className="sr-only">Delete Intent</span>
          </button>
          <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900 px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-sm transition group-hover:opacity-100">
            Delete Intent
          </span>
        </div>
      </div>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const nodeTypes = { intent: IntentNode };

const FlowContent: FC<IntentFlowCanvasProps> = ({
  intents,
  selectedIntentId,
  onSelectIntent,
  onCreateFollowUp,
  onEditIntent,
  onDeleteIntent,
  onEditFallback,
}) => {
  const { fitView } = useReactFlow();
  const [nodes, setNodes] = useState<Node<NodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    const { nodes: builtNodes, edges: builtEdges } = buildGraph(intents, selectedIntentId, {
      onSelectIntent,
      onCreateFollowUp,
      onEditIntent,
      onDeleteIntent,
      onEditFallback,
    });
    setNodes(builtNodes);
    setEdges(builtEdges);
    requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 400 });
    });
  }, [intents, selectedIntentId, onSelectIntent, onCreateFollowUp, onEditIntent, onDeleteIntent, onEditFallback, fitView]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, node) => onSelectIntent(Number(node.id))}
        nodeTypes={nodeTypes}
      >
        <Background gap={16} color="#e2e8f0" />
        <Controls className="bg-white" />
      </ReactFlow>
    </div>
  );
};

const IntentFlowCanvas: FC<IntentFlowCanvasProps> = (props) => (
  <ReactFlowProvider>
    <FlowContent {...props} />
  </ReactFlowProvider>
);

export default IntentFlowCanvas;

function buildGraph(
  intents: IntentTreeNode[],
  selectedIntentId: number | null,
  actions: Pick<IntentFlowCanvasProps, 'onSelectIntent' | 'onCreateFollowUp' | 'onEditIntent' | 'onDeleteIntent' | 'onEditFallback'>,
) {
  const flatten: IntentTreeNode[] = [];
  const edges: Edge[] = [];

  const traverse = (nodes: IntentTreeNode[], depth: number, parentId?: number | null) => {
    nodes.forEach((node) => {
      flatten.push({ ...node, depth } as IntentTreeNode & { depth: number });
      if (parentId) {
        edges.push({ id: `${parentId}-${node.id}`, source: String(parentId), target: String(node.id) });
      }
      traverse(node.children ?? [], depth + 1, node.id);
    });
  };

  traverse(intents, 0, null);

  const grouped = flatten.reduce((acc, intent: IntentTreeNode & { depth?: number }) => {
    const depth = intent.depth ?? 0;
    if (!acc.has(depth)) acc.set(depth, []);
    acc.get(depth)!.push(intent);
    return acc;
  }, new Map<number, (IntentTreeNode & { depth?: number })[]>());

  const nodes: Node<NodeData>[] = [];
  grouped.forEach((levelNodes, depth) => {
    levelNodes.forEach((intent, index) => {
      nodes.push({
        id: String(intent.id),
        type: 'intent',
        position: {
          x: index * HORIZONTAL_GAP,
          y: depth * VERTICAL_GAP,
        },
        style: { width: NODE_WIDTH, height: NODE_HEIGHT },
        data: {
          intent,
          selected: selectedIntentId === intent.id,
          onSelect: actions.onSelectIntent,
          onCreateFollowUp: actions.onCreateFollowUp,
          onEdit: actions.onEditIntent,
          onDelete: actions.onDeleteIntent,
          onEditFallback: actions.onEditFallback,
        },
      });
    });
  });

  return { nodes, edges };
}
