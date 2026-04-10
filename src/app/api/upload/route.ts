import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";

const R2 = new S3Client({
  region: "auto",
  endpoint: "https://e85a317307ded192b278147f39b9c4c6.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: "64f6be749ea178cafbb185097d66dc36",
    secretAccessKey: "5864f911cbca1176ccc7c12d85d97d220af03e7a7f8bc177e7e6c06a06474a13",
  },
});

const BUCKET = "tdqv-media";
const PUBLIC_URL = "https://pub-33983833a1b949e2a0ef4d0fe7e3f320.r2.dev";

// GET: genera una presigned URL para subida directa desde el navegador.
export async function GET(req: NextRequest) {
  const folder = req.nextUrl.searchParams.get("folder") || "uploads";
  const filename = req.nextUrl.searchParams.get("filename") || "file";
  const contentType = req.nextUrl.searchParams.get("contentType") || "application/octet-stream";

  const key = `${folder}/${filename}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const presignedUrl = await getSignedUrl(R2, command, { expiresIn: 300 });

  return NextResponse.json({
    uploadUrl: presignedUrl,
    publicUrl: `${PUBLIC_URL}/${key}`,
    key,
  });
}

// POST: subida directa para archivos pequeños (< 4MB).
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "uploads";

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "";
    const baseName = file.name.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    const key = `${folder}/${baseName}.${ext}`;
    const bytes = await file.arrayBuffer();

    await R2.send(new PutObjectCommand({
      Bucket: BUCKET, Key: key,
      Body: Buffer.from(bytes),
      ContentType: file.type || "application/octet-stream",
    }));

    return NextResponse.json({ url: `${PUBLIC_URL}/${key}`, key });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
