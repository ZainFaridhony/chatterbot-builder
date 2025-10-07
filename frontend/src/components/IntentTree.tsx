import { FC } from 'react';
import { IntentTreeNode } from '../hooks/useIntents';
import IntentNodeItem from './IntentNode';

interface IntentTreeProps {
  intents: IntentTreeNode[];
  onSelect?: (intent: IntentTreeNode) => void;
  selectedId?: number | null;
  onEditIntent?: (intent: IntentTreeNode) => void;
  onDeleteIntent?: (intent: IntentTreeNode) => void;
}

const IntentTree: FC<IntentTreeProps> = ({
  intents,
  onSelect,
  selectedId,
  onEditIntent,
  onDeleteIntent,
}) => (
  <div className="space-y-1">
    {intents.map((intent) => (
      <IntentNodeItem
        key={intent.id}
        node={intent}
        depth={0}
        onSelect={onSelect}
        selectedId={selectedId ?? null}
        onEditIntent={onEditIntent}
        onDeleteIntent={onDeleteIntent}
      />
    ))}
  </div>
);

export default IntentTree;
