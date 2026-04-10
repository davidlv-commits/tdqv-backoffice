/**
 * Sube un archivo a R2 usando presigned URL.
 * Paso 1: pide una presigned URL al API route.
 * Paso 2: sube directamente desde el navegador a R2 (sin límite de tamaño).
 * Retorna la URL pública del archivo subido.
 */
export async function uploadFile(file: File, folder: string): Promise<string> {
  // Clean filename.
  const ext = file.name.split(".").pop() || "";
  const baseName = file.name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
  const filename = `${baseName}.${ext}`;

  // Step 1: Get presigned URL.
  const res = await fetch(
    `/api/upload?folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(file.type)}`
  );

  if (!res.ok) throw new Error("Failed to get upload URL");
  const { uploadUrl, publicUrl } = await res.json();

  // Step 2: Upload directly to R2.
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });

  if (!uploadRes.ok) throw new Error("Upload to R2 failed");

  return publicUrl;
}
