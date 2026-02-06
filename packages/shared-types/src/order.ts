export type OrderStatus = 'pending' | 'confirmed' | 'fulfilled' | 'cancelled';

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  tenantId: string;
  scheduleId: string;
  orderId: string;
  userId: string;
  encryptedUserEmail: string;
  encryptedUserDisplayName: string;
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  pickupInstructions: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  fulfilledAt?: string;
}

export interface CreateOrderInput {
  scheduleId: string;
  items: {
    menuItemId: string;
    quantity: number;
  }[];
  notes?: string;
}

export interface OrderSummary {
  orderId: string;
  scheduleId: string;
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  pickupInstructions: string;
  notes?: string;
  createdAt: string;
  fulfilledAt?: string;
  userEmail?: string;
  userDisplayName?: string;
}
