import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Spinner, EmptyState, Modal, Button } from '@fooder/shared-ui';
import { MenuItemCard } from '../components/MenuItemCard';
import { apiClient } from '../api/client';
import { useEffect } from 'react';
import type { MenuItem } from '@fooder/shared-types';

export function MenuItems() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<{ data: MenuItem[] }>('/api/menu-items?includeInactive=true').then((res) => {
      setItems(res.data.data);
      setIsLoading(false);
    });
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    await apiClient.delete(`/api/menu-items/${deleteId}`);
    setItems((prev) => prev.filter((i) => i.menuItemId !== deleteId));
    setDeleteId(null);
  };

  if (isLoading) {
    return <Spinner size="lg" />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Menu Items</h1>
        <Link to="/menu-items/new" className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" role="link">
          Add Item
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No menu items" description="Create your first menu item to get started." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <MenuItemCard
              key={item.menuItemId}
              item={item}
              onEdit={(id) => navigate(`/menu-items/${id}/edit`)}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>
      )}

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Menu Item">
        <p>Are you sure you want to delete this item?</p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" onClick={handleDelete}>Confirm</Button>
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  );
}
