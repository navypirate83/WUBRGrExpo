/* =====================================================================
   ERROR HANDLING
   Two pieces. handleDbError turns a database error into a short, safe
   answer (every route's catch block calls it, so the rules live in one
   place). errorHandler is the safety net at the very end for anything
   a route didn't catch, such as broken JSON in the request.
   Neither ever sends the raw error, a file path or a stack trace.
   ===================================================================== */

// Turn a database error into a safe answer for the caller
export function handleDbError(err, res) {
  // The data broke one of the model's own rules: its messages are safe to show
  if (err?.name === 'ValidationError') {
    const messages = Object.values(err.errors ?? {}).map((e) => e.message);
    return res.status(400).json({ error: messages.join('. ') || 'Invalid data' });
  }
  // A value of the wrong kind (like an id that isn't a real id)
  if (err?.name === 'CastError') {
    const isId = err.path === '_id' || err.kind === 'ObjectId';
    return res.status(400).json({ error: isId ? 'Invalid ID format' : `Invalid value for ${err.path}` });
  }
  // A "must be unique" rule was broken (like a taken email)
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'That value is already in use' });
  }
  // Anything else: tell the caller nothing, tell the server's terminal everything
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong' });
}

// The last stop for errors no route caught (must keep exactly 4 parameters)
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }
  if (err?.type === 'encoding.unsupported' || err?.type === 'charset.unsupported') {
    return res.status(415).json({ error: 'Unsupported content type or encoding' });
  }
  if (typeof err?.code === 'string' && err.code.startsWith('Z_')) {
    return res.status(400).json({ error: 'Bad request' });
  }
  const status = err?.status ?? err?.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return res.status(status).json({ error: 'Bad request' });
  }
  return handleDbError(err, res);
}
