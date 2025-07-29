export interface Account {
  _id: string;
  username: string;
  password: string;
  proxy: string | null;
  points: number;
  status: 'active' | 'inactive' | 'proxy_error';
  websiteType: 'sgd666' | 'one789';
  createdAt: string;
  updatedAt: string;
}

export interface AccountFormData {
  username: string;
  password: string;
  proxy: string;
  points: number;
  status: 'active' | 'inactive' | 'proxy_error';
  websiteType: 'sgd666' | 'one789';
}