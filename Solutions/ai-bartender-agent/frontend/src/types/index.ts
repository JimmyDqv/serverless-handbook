// API Response Types
export interface Section {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Section Request Types
export interface CreateSectionRequest {
  name: string;
  display_order: number;
}

export interface UpdateSectionRequest {
  id: string;
  name?: string;
  display_order?: number;
}

// Recipe Types (Swedish only)
export interface RecipeIngredient {
  name: string;
  amount: string;       // e.g., "50ml", "2 dashes", "1 slice"
  optional: boolean;
}

export interface RecipeStep {
  order: number;
  instruction: string;
}

export interface DrinkRecipe {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  garnish?: string;
  glassware?: string;
  preparation_time?: number;  // minutes
}

export interface Drink {
  id: string;
  name: string;
  section_id: string;
  section_name: string;
  description: string;
  ingredients: string[];  // Legacy - simple array, kept for backwards compatibility
  recipe?: DrinkRecipe;   // Structured recipe
  image_url: string;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  drink: {
    id: string;
    name: string;
    image_url: string;
  };
  user_session_id: string;
  username?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface OrdersMetadata {
  pending_count: number;
  in_progress_count: number;
  completed_24h_count: number;
  pending_returned: number;
}

export interface AdminOrdersResponse {
  orders: Order[];
  metadata: OrdersMetadata;
}

// API Request Types
export interface CreateOrderRequest {
  drink_id: string;
  user_session_id: string;
}

export interface CreateDrinkRequest {
  name: string;
  section_id: string;
  description: string;
  ingredients: string[];
  recipe?: DrinkRecipe | null;
  image_url?: string;
  is_active?: boolean;
}

export interface UpdateDrinkRequest extends Partial<CreateDrinkRequest> {
  id: string;
}

// UI State Types
export interface DrinkFilters {
  section_id?: string;
  search?: string;
}

export interface OrderStatus {
  order: Order;
  estimated_time?: number;
}

// Registration Code Types
export interface RegistrationCode {
  code: string;
  created_at: string;
  created_by: string;
  expires_at: string;
  is_used: boolean;
  used_at?: string;
  used_by_user_key?: string;
  notes?: string;
  max_uses: number;
  use_count: number;
  registration_url: string;
}

export interface CreateRegistrationCodeRequest {
  expires_in_hours?: number;
  notes?: string;
  max_uses?: number;
}