/**
 * Canvas-based image preprocessing for OCR optimization.
 * Handles: dark mode detection/inversion, grayscale, binarization, scaling.
 */

/**
 * Load a File into an HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    const url = URL.createObjectURL(file);
    img.src = url;
  });
}

/**
 * Preprocess an image for OCR:
 * 1. Load image onto canvas
 * 2. Detect dark mode (check average brightness of middle 60%) and invert if needed
 * 3. Convert to grayscale
 * 4. Apply Otsu-like threshold (binarization)
 * 5. Scale up 2x for better OCR accuracy
 * 
 * Returns a canvas element ready for Tesseract.js
 */
export async function preprocessImageForOCR(file: File): Promise<HTMLCanvasElement> {
  const img = await loadImage(file);
  
  // Create initial canvas at original size
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);

  // Revoke the object URL
  URL.revokeObjectURL(img.src);

  const width = canvas.width;
  const height = canvas.height;

  // Get pixel data
  let imageData = ctx.getImageData(0, 0, width, height);
  let pixels = imageData.data;

  // Step 1: Detect dark mode by checking average brightness of middle 60% area
  // (avoid top header bar which might be dark in both modes)
  const startY = Math.floor(height * 0.4);
  const endY = height;
  let totalBrightness = 0;
  let pixelCount = 0;

  for (let y = startY; y < endY; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const brightness = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
      totalBrightness += brightness;
      pixelCount++;
    }
  }

  const avgBrightness = totalBrightness / pixelCount;
  const isDarkMode = avgBrightness < 128;

  if (isDarkMode) {
    // Invert all pixels for dark mode
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255 - pixels[i];       // R
      pixels[i + 1] = 255 - pixels[i + 1]; // G
      pixels[i + 2] = 255 - pixels[i + 2]; // B
      // Alpha stays the same
    }
    ctx.putImageData(imageData, 0, 0);
    // Re-get the image data after inversion
    imageData = ctx.getImageData(0, 0, width, height);
    pixels = imageData.data;
  }

  // Step 2: Convert to grayscale
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    pixels[i] = gray;
    pixels[i + 1] = gray;
    pixels[i + 2] = gray;
  }

  // Step 3: Otsu-like thresholding (binarization)
  // Calculate histogram
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < pixels.length; i += 4) {
    histogram[pixels[i]]++;
  }

  // Find Otsu threshold
  const totalPixels = width * height;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i];

  let sumBg = 0;
  let weightBg = 0;
  let maxVariance = 0;
  let threshold = 128; // default

  for (let t = 0; t < 256; t++) {
    weightBg += histogram[t];
    if (weightBg === 0) continue;
    const weightFg = totalPixels - weightBg;
    if (weightFg === 0) break;

    sumBg += t * histogram[t];
    const meanBg = sumBg / weightBg;
    const meanFg = (sumAll - sumBg) / weightFg;
    const variance = weightBg * weightFg * (meanBg - meanFg) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  // Apply threshold
  for (let i = 0; i < pixels.length; i += 4) {
    const val = pixels[i] >= threshold ? 255 : 0;
    pixels[i] = val;
    pixels[i + 1] = val;
    pixels[i + 2] = val;
  }

  ctx.putImageData(imageData, 0, 0);

  // Step 4: Scale up 2x for better OCR accuracy
  const scaledCanvas = document.createElement('canvas');
  const scaledCtx = scaledCanvas.getContext('2d')!;
  scaledCanvas.width = width * 2;
  scaledCanvas.height = height * 2;
  
  // Use high-quality scaling
  scaledCtx.imageSmoothingEnabled = true;
  scaledCtx.imageSmoothingQuality = 'high';
  scaledCtx.drawImage(canvas, 0, 0, width * 2, height * 2);

  console.log('[OCR Preprocess]', {
    originalSize: `${width}x${height}`,
    scaledSize: `${scaledCanvas.width}x${scaledCanvas.height}`,
    isDarkMode,
    avgBrightness: Math.round(avgBrightness),
    otsuThreshold: threshold,
  });

  return scaledCanvas;
}
