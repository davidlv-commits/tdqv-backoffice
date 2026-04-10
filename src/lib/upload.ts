/**
 * Sube un archivo a R2 via la API route /api/upload.
 * Retorna la URL pública del archivo subido.
 */
export async function uploadFile(
  file: File,
  folder: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Upload failed");
  }

  const data = await res.json();
  return data.url;
}
