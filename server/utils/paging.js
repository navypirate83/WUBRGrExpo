/* =====================================================================
   PAGING
   Long lists are sent a page at a time (like pages in a book), so one
   request never has to carry thousands of items.
   ===================================================================== */

// Reads ?page and ?limit from the address. Both must be whole numbers
// of 1 or more; limit is at most 100 (default 50). Returns
// { page, limit, skip } or { error } with a message to send back.
export function parsePaging(query) {
  const whole = (value, name, fallback) => {
    if (value === undefined) return { value: fallback };
    if (typeof value !== 'string' || !/^[0-9]+$/.test(value) || Number(value) < 1) {
      return { error: `${name} must be a whole number of 1 or more` };
    }
    return { value: Number(value) };
  };
  const page = whole(query.page, 'page', 1);
  if (page.error) return { error: page.error };
  const limit = whole(query.limit, 'limit', 50);
  if (limit.error) return { error: limit.error };
  if (limit.value > 100) return { error: 'limit can be at most 100' };
  return { page: page.value, limit: limit.value, skip: (page.value - 1) * limit.value };
}
