export function validatePhotoSelection(files: File[], available: number) {
  if (files.length > available) throw new Error(`Choose up to ${available} photo${available === 1 ? '' : 's'} for the remaining spaces.`);
  for (const file of files) {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error('Please choose JPG, PNG, or WebP photos. Convert HEIC photos to JPG first.');
    if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} is too large. Choose a photo under 20 MB.`);
  }
}

// Decode locally and normalize size/orientation before using the shared card renderer.
export async function importPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Empty image');
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .95);
  } catch { throw new Error(`Could not open ${file.name}. Try another JPG, PNG, or WebP photo.`); }
  finally { URL.revokeObjectURL(url); }
}
