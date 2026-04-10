import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "uploads";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Generate a clean filename.
    const ext = file.name.split(".").pop() || "";
    const baseName = file.name
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");
    const key = `${folder}/${baseName}.${ext}`;

    // Read file bytes.
    const bytes = await file.arrayBuffer();

    // Upload to R2.
    await R2.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: Buffer.from(bytes),
        ContentType: file.type || "application/octet-stream",
      })
    );

    const publicUrl = `${PUBLIC_URL}/${key}`;

    return NextResponse.json({ url: publicUrl, key });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
