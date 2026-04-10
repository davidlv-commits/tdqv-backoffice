/**
 * Sube un archivo a R2 usando presigned URL con progreso.
 */
export async function uploadFile(
  file: File,
  folder: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const ext = file.name.split(".").pop() || "";
  const baseName = file.name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
  const filename = `${baseName}.${ext}`;

  // Step 1: Get presigned URL.
  onProgress?.(0);
  const res = await fetch(
    `/api/upload?folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(file.type)}`
  );
  if (!res.ok) throw new Error("Failed to get upload URL");
  const { uploadUrl, publicUrl } = await res.json();

  // Step 2: Upload with progress via XMLHttpRequest.
  onProgress?.(5);
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 90) + 5; // 5-95%
        onProgress?.(percent);
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Upload error")));
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });

  return publicUrl;
}
