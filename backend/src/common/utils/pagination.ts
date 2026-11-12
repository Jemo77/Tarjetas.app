export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export const MAX_PAGE_SIZE = 100;

export function parsePagination(
  pageRaw?: string | number,
  pageSizeRaw?: string | number,
): Pagination {
  const page = Math.max(1, Number(pageRaw) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(pageSizeRaw) || 20),
  );
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number) {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}