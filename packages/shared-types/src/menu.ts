export interface MenuItem {
  tenantId: string;
  menuItemId: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMenuItemInput {
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  category: string;
}

export interface UpdateMenuItemInput {
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  category?: string;
  isActive?: boolean;
}
