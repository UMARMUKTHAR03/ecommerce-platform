import { apiGetServer } from './api';
import { fallbackProducts } from './fallback-catalog';
import type {
  Product,
  ProductListResponse,
  Review,
  SearchProductsResponse,
} from './types';

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  createdAt: string;
  children: CategoryNode[];
}

const defaultCategories: CategoryNode[] = [
  { id: 'a0000000-0000-0000-0000-000000000010', name: 'Smartphones', slug: 'smartphones', parentId: null, createdAt: new Date().toISOString(), children: [] },
  { id: 'a0000000-0000-0000-0000-000000000020', name: 'Home & Kitchen', slug: 'home-kitchen', parentId: null, createdAt: new Date().toISOString(), children: [] },
  { id: 'a0000000-0000-0000-0000-000000000030', name: 'Fashion', slug: 'fashion', parentId: null, createdAt: new Date().toISOString(), children: [] },
  { id: 'a0000000-0000-0000-0000-000000000040', name: 'Beauty', slug: 'beauty', parentId: null, createdAt: new Date().toISOString(), children: [] },
  { id: 'a0000000-0000-0000-0000-000000000050', name: 'Sports', slug: 'sports', parentId: null, createdAt: new Date().toISOString(), children: [] },
  { id: 'a0000000-0000-0000-0000-000000000060', name: 'Accessories', slug: 'accessories', parentId: null, createdAt: new Date().toISOString(), children: [] },
];

export async function getCategoryTree() {
  try {
    const list = await apiGetServer<CategoryNode[]>('/store/categories');
    return list && list.length ? list : defaultCategories;
  } catch {
    return defaultCategories;
  }
}

export function flattenCategories(tree: CategoryNode[]): CategoryNode[] {
  const output: CategoryNode[] = [];

  function walk(nodes: CategoryNode[]) {
    for (const node of nodes) {
      output.push(node);
      if (node.children && node.children.length) {
        walk(node.children);
      }
    }
  }

  walk(tree);
  return output.length ? output : defaultCategories;
}

export async function getProducts(params: Record<string, string | number | boolean | undefined>) {
  try {
    const payload = await apiGetServer<ProductListResponse>('/store/products', params);
    if (payload && payload.items && payload.items.length) {
      return payload;
    }
  } catch {
    // Proceed to fallback
  }

  // Filter fallback catalog
  let filtered = [...fallbackProducts];
  const cat = params.category ? String(params.category).toLowerCase() : null;
  if (cat) {
    filtered = filtered.filter((p) => p.category?.slug.toLowerCase() === cat);
  }

  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 12);
  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit);

  return {
    items: paginated,
    pagination: {
      page,
      limit,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / limit) || 1,
    },
  };
}

export async function getProductBySlug(slug: string) {
  try {
    const product = await apiGetServer<Product>(`/store/products/${slug}`);
    if (product) return product;
  } catch {
    // Proceed to fallback
  }

  return fallbackProducts.find((p) => p.slug === slug) ?? null;
}

export async function getProductReviews(productId: string, page = 1, limit = 10) {
  try {
    return await apiGetServer<{ items: Review[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/store/products/${productId}/reviews`,
      { page, limit },
    );
  } catch {
    return {
      items: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }
}

export async function searchProducts(
  params: Record<string, string | number | boolean | undefined>,
) {
  try {
    return await apiGetServer<SearchProductsResponse>('/store/search', params);
  } catch {
    return {
      items: [],
      pagination: {
        page: Number(params.page ?? 1),
        limit: Number(params.limit ?? 12),
        total: 0,
        totalPages: 0,
      },
      query: String(params.q ?? ''),
    };
  }
}
