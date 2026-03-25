export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const method = req?.method || "UNKNOWN";
  const path = req?.originalUrl || req?.url || "unknown";

  if (statusCode >= 500) {
    console.error("ERROR:", err);
  } else {
    console.warn(`${statusCode} ${method} ${path}: ${err.message || "Request failed"}`);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack
    })
  });
}
