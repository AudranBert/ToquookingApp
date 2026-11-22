const IMAGE_COMPRESSION = {
  maxDimension: 1600,
  quality: 0.8,
  mimeType: "image/webp",
} as const;

function readDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be decoded"));
    image.src = src;
  });
}

function encode(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, IMAGE_COMPRESSION.quality)
  );
}

/** Device uploads only. Remote URLs never pass through canvas or get downloaded. */
export async function compressImageFile(file: File): Promise<string> {
  // Keep animations intact. Photos and other static formats are optimized below.
  if (file.type === "image/gif") return readDataUrl(file);
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(
      1,
      IMAGE_COMPRESSION.maxDimension / Math.max(image.naturalWidth, image.naturalHeight)
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return readDataUrl(file);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let compressed = await encode(canvas, IMAGE_COMPRESSION.mimeType);
    if (!compressed || compressed.type !== IMAGE_COMPRESSION.mimeType) {
      // Browsers without WebP encoding support use JPEG instead of a large PNG.
      context.globalCompositeOperation = "destination-over";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      compressed = await encode(canvas, "image/jpeg");
    }
    // Encoding an already tiny image must never increase its storage cost.
    return readDataUrl(compressed && compressed.size < file.size ? compressed : file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
