import { FC, useState } from 'react';
import classNames from 'classnames';
import { RiArrowDownSLine, RiArrowRightSLine, RiDeleteBinLine, RiEditLine } from 'react-icons/ri';
import { IntentTreeNode } from '../hooks/useIntents';

interface IntentNodeProps {
  node: IntentTreeNode;
  depth?: number;
  onSelect?: (node: IntentTreeNode) => void;
  selectedId?: number | null;
  onEditIntent?: (node: IntentTreeNode) => void;
  onDeleteIntent?: (node: IntentTreeNode) => void;
}

const IntentNodeItem: FC<IntentNodeProps> = ({
  node,
  depth = 0,
  onSelect,
  selectedId,
  onEditIntent,
  onDeleteIntent,
}) => {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = Boolean(node.children && node.children.length);

  const toggle = () => {
    if (hasChildren) {
      setExpanded((prev) => !prev);
    }
  };

  const handleRowClick = () => {
    if (hasChildren && !expanded) {
      setExpanded(true);
    }
    onSelect?.(node);
  };

  return (
    <div className="flex flex-col">
      <div
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleRowClick();
          }
        }}
        className={classNames(
          'group flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-left transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          {
            'bg-primary-light text-primary': selectedId === node.id,
          }
        )}
        style={{ marginLeft: depth * 20 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-slate-200"
          >
            {expanded ? (
              <RiArrowDownSLine className="text-slate-500" />
            ) : (
              <RiArrowRightSLine className="text-slate-500" />
            )}
          </button>
        ) : (
          <span className="w-6" />
        )}
        <span
          className={classNames('h-2 w-2 flex-shrink-0 rounded-full', {
            'bg-primary': node.is_active,
            'bg-slate-300': !node.is_active,
          })}
        />
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium capitalize">{node.name}</span>
            {node.is_default_welcome && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                Welcome
              </span>
            )}
            {node.is_fallback && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                Fallback
              </span>
            )}
          </div>
          {node.description && <span className="text-xs text-slate-500">{node.description}</span>}
        </div>
        {(onEditIntent || onDeleteIntent) && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {onDeleteIntent && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteIntent(node);
                }}
                className="rounded-full p-1 text-rose-400 transition hover:bg-rose-100 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                title="Delete intent"
                aria-label={`Delete ${node.name}`}
              >
                <RiDeleteBinLine className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEditIntent(node);
              }}
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              title="Edit intent"
              aria-label={`Edit ${node.name}`}
            >
              <RiEditLine className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {expanded && hasChildren && (
        <div className="flex flex-col border-l border-slate-200 pl-3">
          {node.children?.map((child) => (
            <IntentNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedId={selectedId}
              onEditIntent={onEditIntent}
              onDeleteIntent={onDeleteIntent}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default IntentNodeItem;
