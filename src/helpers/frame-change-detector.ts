import sharp from 'sharp';

export async function hasSignificantChange(
  prevPath: string,
  currPath: string,
  pixelDiffThreshold: number = 12,
  minChangedFraction: number = 0.02
): Promise<boolean> {
  const targetWidth = 256;
  const targetHeight = 144;

  const [prevBuffer, currBuffer] = await Promise.all([
    sharp(prevPath).resize(targetWidth, targetHeight).greyscale().raw().toBuffer(),
    sharp(currPath).resize(targetWidth, targetHeight).greyscale().raw().toBuffer()
  ]);

  let changed = 0;
  const total = targetWidth * targetHeight;

  for (let i = 0; i < total; i++) {
    if (Math.abs(currBuffer[i] - prevBuffer[i]) > pixelDiffThreshold) {
      changed++;
    }
  }

  const fraction = changed / total;
  return fraction >= minChangedFraction;
}