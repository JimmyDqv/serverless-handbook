import { get, post, put, del } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import {
  Section,
  Drink,
  Order,
  OrdersMetadata,
  AdminOrdersResponse,
  CreateOrderRequest,
  CreateDrinkRequest,
  UpdateDrinkRequest,
  CreateSectionRequest,
  UpdateSectionRequest,
  DrinkFilters,
  RegistrationCode,
  CreateRegistrationCodeRequest
} from '../types';

const API_NAME = 'AiBartender';
const API_KEY = import.meta.env.VITE_API_KEY || '';

// API response wrapper type
interface ApiResponse<T> {
  data: T;
}

// Common headers for all requests
// useAdminAuth: true = always use Cognito session (admin), false = use localStorage token (guest user)
const getHeaders = async (requireAuth = false, useAdminAuth = false): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'x-api-key': API_KEY,
  };

  if (requireAuth) {
    try {
      if (useAdminAuth) {
        // Admin endpoints: always use Cognito session token
        const session = await fetchAuthSession();
        const token = session.tokens?.accessToken?.toString();

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        } else {
          console.warn('No Cognito access token available for admin request');
        }
      } else {
        // User endpoints: use localStorage token (guest user authentication)
        const accessToken = localStorage.getItem('access_token');

        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        } else {
          // Fall back to Cognito session if no localStorage token
          const session = await fetchAuthSession();
          const token = session.tokens?.accessToken?.toString();

          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          } else {
            console.warn('No access token available for authenticated request');
          }
        }
      }
    } catch (error) {
      console.error('Error getting access token:', error);
    }
  }

  return headers;
};

// Public API endpoints
export const sectionsApi = {
  getAll: async (): Promise<Section[]> => {
    const headers = await getHeaders();
    const response = await get({
      apiName: API_NAME,
      path: '/sections',
      options: {
        headers,
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<Section[]>;
    return json.data;
  }
};

export const drinksApi = {
  getAll: async (filters?: DrinkFilters): Promise<Drink[]> => {
    const params = new URLSearchParams();
    if (filters?.section_id) {
      params.append('section_id', filters.section_id);
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }

    const path = `/drinks${params.toString() ? `?${params.toString()}` : ''}`;
    const headers = await getHeaders();
    const response = await get({
      apiName: API_NAME,
      path,
      options: {
        headers,
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<Drink[]>;
    return json.data;
  },

  getById: async (id: string): Promise<Drink> => {
    const headers = await getHeaders();
    const response = await get({
      apiName: API_NAME,
      path: `/drinks/${id}`,
      options: {
        headers,
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<Drink>;
    return json.data;
  }
};

export const ordersApi = {
  create: async (orderData: CreateOrderRequest): Promise<Order> => {
    const headers = await getHeaders(true);  // Requires auth - user JWT token
    const response = await post({
      apiName: API_NAME,
      path: '/orders',
      options: {
        body: JSON.stringify(orderData) as any,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<Order>;
    return json.data;
  },

  getById: async (id: string): Promise<Order> => {
    const headers = await getHeaders(true);  // Requires auth - user JWT token
    const response = await get({
      apiName: API_NAME,
      path: `/orders/${id}`,
      options: {
        headers,
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<Order>;
    return json.data;
  },

  getMyOrders: async (includeCompleted = false): Promise<Order[]> => {
    const headers = await getHeaders(true);  // Requires auth - user JWT token
    const path = includeCompleted ? '/orders?include_completed=true' : '/orders';
    const response = await get({
      apiName: API_NAME,
      path,
      options: {
        headers,
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<Order[]>;
    return json.data;
  }
};

// Admin API endpoints (require authentication via Cognito)
export const adminDrinksApi = {
  getAll: async (): Promise<Drink[]> => {
    const headers = await getHeaders(true, true); // useAdminAuth = true
    const response = await get({
      apiName: API_NAME,
      path: '/admin/drinks',
      options: {
        headers,
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<Drink[]>;
    return json.data;
  },

  create: async (drinkData: CreateDrinkRequest): Promise<Drink> => {
    const headers = await getHeaders(true, true); // useAdminAuth = true
    const response = await post({
      apiName: API_NAME,
      path: '/admin/drinks',
      options: {
        body: JSON.stringify(drinkData) as any,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<Drink>;
    return json.data;
  },

  update: async (drinkData: UpdateDrinkRequest): Promise<Drink> => {
    const headers = await getHeaders(true, true); // useAdminAuth = true
    const response = await put({
      apiName: API_NAME,
      path: `/admin/drinks/${drinkData.id}`,
      options: {
        body: JSON.stringify(drinkData) as any,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<Drink>;
    return json.data;
  },

  delete: async (id: string): Promise<void> => {
    const headers = await getHeaders(true, true); // useAdminAuth = true
    await del({
      apiName: API_NAME,
      path: `/admin/drinks/${id}`,
      options: {
        headers,
      }
    }).response;
  }
};

// Response type for admin orders endpoint (includes metadata)
interface AdminOrdersApiResponse {
  data: Order[];
  metadata: OrdersMetadata;
}

export const adminOrdersApi = {
  getAll: async (): Promise<AdminOrdersResponse> => {
    const headers = await getHeaders(true, true); // useAdminAuth = true
    const response = await get({
      apiName: API_NAME,
      path: '/admin/orders',
      options: {
        headers,
      }
    }).response;
    const json = await response.body.json() as unknown as AdminOrdersApiResponse;
    return {
      orders: json.data,
      metadata: json.metadata,
    };
  },

  updateStatus: async (id: string, status: Order['status']): Promise<Order> => {
    const headers = await getHeaders(true, true); // useAdminAuth = true
    const response = await put({
      apiName: API_NAME,
      path: `/admin/orders/${id}`,
      options: {
        body: JSON.stringify({ status }) as any,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<Order>;
    return json.data;
  }
};

// Admin Sections API (require authentication via Cognito)
export const adminSectionsApi = {
  getAll: async (): Promise<Section[]> => {
    const headers = await getHeaders(true, true); // useAdminAuth = true
    const response = await get({
      apiName: API_NAME,
      path: '/admin/sections',
      options: {
        headers,
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<Section[]>;
    return json.data;
  },

  create: async (sectionData: CreateSectionRequest): Promise<Section> => {
    const headers = await getHeaders(true, true); // useAdminAuth = true
    const response = await post({
      apiName: API_NAME,
      path: '/admin/sections',
      options: {
        body: JSON.stringify(sectionData),
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<Section>;
    return json.data;
  },

  update: async (sectionData: UpdateSectionRequest): Promise<Section> => {
    const headers = await getHeaders(true, true); // useAdminAuth = true
    const response = await put({
      apiName: API_NAME,
      path: `/admin/sections/${sectionData.id}`,
      options: {
        body: JSON.stringify(sectionData),
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<Section>;
    return json.data;
  },

  delete: async (id: string): Promise<void> => {
    const headers = await getHeaders(true, true); // useAdminAuth = true
    try {
      const response = await del({
        apiName: API_NAME,
        path: `/admin/sections/${id}`,
        options: {
          headers,
        }
      }).response;
      await response.body.json(); // Consume the response
    } catch (error: any) {
      console.error('Delete section error:', error);
      
      // Try to extract error details from the Amplify error structure
      let errorData: any = {};
      let statusCode = 500;
      
      try {
        // Amplify v6 error structure
        if (error.response?.body) {
          const bodyText = await error.response.body.text();
          errorData = JSON.parse(bodyText);
          statusCode = error.response.statusCode || 500;
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
      }
      
      // Throw structured error
      const structuredError: any = new Error(errorData.error || error.message || 'Failed to delete section');
      structuredError.response = {
        status: statusCode,
        data: errorData,
      };
      throw structuredError;
    }
  }
};

// Admin Image API endpoints (require authentication via Cognito)
export const adminImagesApi = {
  generatePresignedUrl: async (contentType: string, drinkId: string): Promise<{ upload_url: string; image_key: string }> => {
    const headers = await getHeaders(true, true); // useAdminAuth = true
    const response = await post({
      apiName: API_NAME,
      path: '/admin/images/upload-url',
      options: {
        body: JSON.stringify({ content_type: contentType, drink_id: drinkId }),
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<{ upload_url: string; image_key: string }>;
    return json.data;
  }
};

// Admin Registration Codes API endpoints (require authentication via Cognito)
export const adminRegistrationCodesApi = {
  getAll: async (status?: 'active' | 'used' | 'expired'): Promise<RegistrationCode[]> => {
    const headers = await getHeaders(true, true); // useAdminAuth = true
    const path = status ? `/admin/registration-codes?status=${status}` : '/admin/registration-codes';
    const response = await get({
      apiName: API_NAME,
      path,
      options: {
        headers,
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<RegistrationCode[]>;
    return json.data;
  },

  create: async (data?: CreateRegistrationCodeRequest): Promise<RegistrationCode> => {
    const headers = await getHeaders(true, true); // useAdminAuth = true
    const response = await post({
      apiName: API_NAME,
      path: '/admin/registration-codes',
      options: {
        body: JSON.stringify(data || {}),
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      }
    }).response;
    const json = await response.body.json() as unknown as ApiResponse<RegistrationCode>;
    return json.data;
  },

  delete: async (code: string): Promise<void> => {
    const headers = await getHeaders(true, true); // useAdminAuth = true
    await del({
      apiName: API_NAME,
      path: `/admin/registration-codes/${code}`,
      options: {
        headers,
      }
    }).response;
  }
};

