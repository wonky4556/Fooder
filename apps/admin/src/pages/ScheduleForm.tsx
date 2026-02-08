import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Button } from '@fooder/shared-ui';
import { apiClient } from '../api/client';
import type { MenuItem } from '@fooder/shared-types';

interface ScheduleItemInput {
  menuItemId: string;
  name: string;
  totalQuantity: number;
}

export function ScheduleForm() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pickupInstructions, setPickupInstructions] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<ScheduleItemInput[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    apiClient.get<{ data: MenuItem[] }>('/api/menu-items?includeInactive=true').then((res) => {
      setMenuItems(res.data.data);
    });
  }, []);

  const handleAddItem = () => {
    const available = menuItems.find((m) => !selectedItems.some((s) => s.menuItemId === m.menuItemId));
    if (available) {
      setSelectedItems((prev) => [...prev, { menuItemId: available.menuItemId, name: available.name, totalQuantity: 1 }]);
    }
  };

  const handleRemoveItem = (menuItemId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  };

  const handleQuantityChange = (menuItemId: string, qty: number) => {
    setSelectedItems((prev) => prev.map((i) => (i.menuItemId === menuItemId ? { ...i, totalQuantity: qty } : i)));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (selectedItems.length === 0) newErrors.items = 'At least one item is required';
    if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
      newErrors.endTime = 'End time must be after start time';
    }
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const body = {
      title,
      description,
      pickupInstructions,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      items: selectedItems.map((i) => ({ menuItemId: i.menuItemId, totalQuantity: i.totalQuantity })),
    };

    await apiClient.post('/api/schedules', body);
    navigate('/schedules');
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">New Schedule</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Pickup Instructions" value={pickupInstructions} onChange={(e) => setPickupInstructions(e.target.value)} />
        <Input label="Start Time" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <Input label="End Time" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} error={errors.endTime} />

        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">Items</h3>
          {errors.items && <p className="mb-2 text-sm text-red-600">{errors.items}</p>}
          {menuItems.map((item) => (
            <div key={item.menuItemId} className="mb-2 flex items-center gap-2">
              <span className="text-sm">{item.name}</span>
              {selectedItems.some((s) => s.menuItemId === item.menuItemId) ? (
                <>
                  <Input
                    label="Quantity"
                    type="number"
                    min={1}
                    value={String(selectedItems.find((s) => s.menuItemId === item.menuItemId)!.totalQuantity)}
                    onChange={(e) => handleQuantityChange(item.menuItemId, Number(e.target.value))}
                  />
                  <Button variant="danger" type="button" onClick={() => handleRemoveItem(item.menuItemId)}>Remove</Button>
                </>
              ) : (
                <Button variant="secondary" type="button" onClick={handleAddItem}>Add</Button>
              )}
            </div>
          ))}
        </div>

        <Button type="submit">Save</Button>
      </form>
    </div>
  );
}
