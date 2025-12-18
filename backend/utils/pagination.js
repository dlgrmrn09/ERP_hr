export const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(parseInt(query.pageSize, 10) || 25, 1),
    100
  );
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
};

export const buildPaginationMeta = (page, pageSize, total) => {
  const totalPages = Math.ceil(total / pageSize) || 1;
  return { page, pageSize, total, totalPages, hasNext: page < totalPages };
};

export default { parsePagination, buildPaginationMeta };
