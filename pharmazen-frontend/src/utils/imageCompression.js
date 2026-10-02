/**
 * Client-side image compression for prescription uploads.
 *
 * Why this exists: Vercel rejects any request body over ~4.5MB *before* the
 * function runs, so a phone photo (commonly 3-8MB) fails with
 * FUNCTION_PAYLOAD_TOO_LARGE no matter what the backend's own limits allow. The
 * backend cannot fix this, because it never sees the bytes. Re-encoding in the
 * browser to a modest JPEG keeps the request inside the platform limit.
 *
 * Deliberately dependency-free: canvas covers this case on its own.
 */

const DEFAULTS = {
  maxDimension: 1600,
  quality: 0.82,
  maxBytes: 1500000,
  minQuality: 0.45,
  qualityStep: 0.12,
};

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });

const canvasToBlob = (canvas, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Image compression failed.')),
      'image/jpeg',
      quality
    );
  });

/**
 * Returns a File small enough to upload. Files already under the target are
 * passed through untouched rather than re-encoded, so quality is never lost for
 * no reason.
 */
export const compressImage = async (file, options = {}) => {
  const { maxDimension, quality, maxBytes, minQuality, qualityStep } = {
    ...DEFAULTS,
    ...options,
  };

  // Canvas cannot decode a PDF, so pass it through and let the size check
  // decide. Prescription PDFs are small in practice.
  if (file.type === 'application/pdf') return file;
  if (file.size <= maxBytes) return file;

  const img = await loadImage(file);

  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));

  const ctx = canvas.getContext('2d');
  // JPEG has no alpha channel. Without an explicit white fill, transparent
  // regions of a PNG come out black once it is flattened.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let currentQuality = quality;
  let blob = await canvasToBlob(canvas, currentQuality);

  // Shrinking dimensions alone may not be enough, so step quality down until
  // the encoded result fits.
  while (blob.size > maxBytes && currentQuality > minQuality) {
    currentQuality = Math.max(minQuality, currentQuality - qualityStep);
    blob = await canvasToBlob(canvas, currentQuality);
  }

  const name = `${file.name.replace(/\.[^.]+$/, '')}.jpg`;
  return new File([blob], name, {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  });
};

export default compressImage;