import type { MenuItem } from '@fooder/shared-types';
import { Card, Badge, Button } from '@fooder/shared-ui';

interface MenuItemCardProps {
  item: MenuItem;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function MenuItemCard({ item, onEdit, onDelete }: MenuItemCardProps) {
  return (
    <Card className="flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{item.name}</h3>
          <Badge text={item.isActive ? 'Active' : 'Inactive'} variant={item.isActive ? 'success' : 'default'} />
        </div>
        <p className="mt-1 text-sm text-gray-500">{item.description}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">${item.price.toFixed(2)}</span>
          <Badge text={item.category} variant="info" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" onClick={() => onEdit(item.menuItemId)}>Edit</Button>
        <Button variant="danger" onClick={() => onDelete(item.menuItemId)}>Delete</Button>
      </div>
    </Card>
  );
}
