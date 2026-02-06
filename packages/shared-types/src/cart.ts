export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  maxQuantity: number;
}

export interface CartState {
  scheduleId: string | null;
  items: CartItem[];
}
