type QueryValue = string | string[] | undefined;

const toNumber = (value: QueryValue): number => {
  const str = Array.isArray(value) ? value[0] : value;
  const parsed = parseInt(str ?? "", 10);
  return Number.isFinite(parsed) ? parsed : NaN;
};

export const parsePagination = (query: {
  page?: QueryValue;
  pageSize?: QueryValue;
}) => {
  const rawPage = toNumber(query.page);
  const rawPageSize = toNumber(query.pageSize);

  const page = Math.max(rawPage || 1, 1);
  // Allow larger page sizes so clients can request all records when needed.
  const pageSize = Math.min(Math.max(rawPageSize || 25, 1), 500);
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
};

export const buildPaginationMeta = (
  page: number,
  pageSize: number,
  total: number
) => {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  return { page, pageSize, total, totalPages, hasNext: page < totalPages };
};

export default { parsePagination, buildPaginationMeta };
