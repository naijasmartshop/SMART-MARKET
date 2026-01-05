export interface Product {
  id: string;
  created_at: string;
  name: string;
  price: string; // Storing as string to keep input simple, or number
  description: string;
  seller_username: string;
  images: string[]; // Base64 strings for this demo to avoid complex storage bucket policies
}

export enum UserRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
}

export interface User {
  email: string;
  username?: string;
  role?: UserRole;
  isAuthenticated: boolean;
}

export type ViewState = 
  | 'AUTH' 
  | 'ROLE_SELECT' 
  | 'BUYER_SETUP' 
  | 'BUYER_DASHBOARD' 
  | 'SELLER_AUTH' 
  | 'SELLER_DASHBOARD';
