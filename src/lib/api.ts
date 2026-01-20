export type Product = {
  id: number;
  title: string;
  description: string;
  price: number;
  discountPercentage?: number;
  rating?: number;
  stock?: number;
  brand?: string;
  category: string;
  thumbnail: string;
  images?: string[];
};

type ProductsResponse = {
  products: Product[];
  total: number;
  skip: number;
  limit: number;
};

const BASE = 'https://dummyjson.com';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

export async function getCategories(): Promise<string[]> {
  return fetchJson<string[]>(`${BASE}/products/categories`);
}

export async function getProducts(category: string | null): Promise<Product[]> {
  const limit = 100;

  if (!category) {
    const data = await fetchJson<ProductsResponse>(
      `${BASE}/products?limit=${limit}`,
    );
    return data.products;
  }

  const data = await fetchJson<ProductsResponse>(
    `${BASE}/products/category/${encodeURIComponent(category)}?limit=${limit}`,
  );
  return data.products;
}
