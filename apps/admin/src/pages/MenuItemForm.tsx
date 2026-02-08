import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Input, Button } from '@fooder/shared-ui';
import { apiClient } from '../api/client';
import type { MenuItem } from '@fooder/shared-types';

export function MenuItemForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (isEdit) {
      apiClient.get<{ data: MenuItem }>(`/api/menu-items/${id}`).then((res) => {
        const item = res.data.data;
        setName(item.name);
        setDescription(item.description);
        setPrice(String(item.price));
        setCategory(item.category);
      });
    }
  }, [id, isEdit]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!price || Number(price) <= 0) newErrors.price = 'Price is required';
    if (!category.trim()) newErrors.category = 'Category is required';
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
    setSubmitError('');

    const body = { name, description, price: Number(price), category };

    try {
      if (isEdit) {
        await apiClient.put(`/api/menu-items/${id}`, body);
      } else {
        await apiClient.post('/api/menu-items', body);
      }
      navigate('/menu-items');
    } catch {
      setSubmitError('Failed to save menu item');
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{isEdit ? 'Edit Menu Item' : 'New Menu Item'}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Price" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} error={errors.price} />
        <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} error={errors.category} />
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
        <Button type="submit">Save</Button>
      </form>
    </div>
  );
}
