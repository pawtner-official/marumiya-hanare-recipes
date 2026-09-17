// スマホ写真（3〜4MB）を長辺 maxSide・JPEG quality に落として data URL で返す。EXIF回転はブラウザに任せる
export async function compressImage(file, { maxSide = 1200, quality = 0.8 } = {}) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}
// 一覧用サムネ（200px・約10KB）と品ページ用（1200px・約250KB）の2枚を作る
export async function makePhotoPair(file) {
  const [thumb, full] = await Promise.all([
    compressImage(file, { maxSide: 200, quality: 0.7 }),
    compressImage(file, { maxSide: 1200, quality: 0.8 }),
  ]);
  return { thumb, full };
}
