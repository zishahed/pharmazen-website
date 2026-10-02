/**
 * Prescription upload limits, shared by the multer config and the controller's
 * error mapping so the two can never drift apart.
 *
 * These are bounded by what Vercel actually delivers, not by what multer would
 * happily accept: the platform rejects any request body over ~4.5MB before the
 * function runs, so a 10MB limit could only ever produce an opaque
 * FUNCTION_PAYLOAD_TOO_LARGE at the edge.
 *
 * The frontend compresses images before sending so a selection fits inside this.
 */

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 2;

/**
 * Turns a multer rejection into a message a user can act on.
 *
 * This has to be called from error-handling middleware, not from a controller
 * try/catch: multer is middleware itself, so it aborts the chain with next(err)
 * and the controller never runs. Left unhandled, Express renders a 500 HTML
 * page containing a stack trace and the server's file paths.
 */
const describeUploadError = (error) => {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return `Each file must be under ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))}MB.`;
    case 'LIMIT_FILE_COUNT':
      return `Maximum ${MAX_FILES} files allowed.`;
    case 'INVALID_FILE_TYPE':
      return error.message;
    default:
      return 'That file could not be uploaded.';
  }
};

module.exports = { MAX_FILE_BYTES, MAX_FILES, describeUploadError };