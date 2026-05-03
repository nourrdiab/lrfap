export type ID = string;

export type ISODateString = string;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiErrorShape {
  message: string;
  code?: string;
  details?: unknown;
}
