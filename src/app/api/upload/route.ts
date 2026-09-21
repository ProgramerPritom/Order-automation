import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

async function getAuthTenant(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token =
    (authHeader?.startsWith('Bearer ') && authHeader.split(' ')[1] !== 'null')
      ? authHeader.split(' ')[1]
      : req.cookies.get('accessToken')?.value || req.cookies.get('token')?.value;

  if (!token) return null;
  return verifyAccessToken(token);
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthTenant(req);
    if (!auth) {
      return NextResponse.json({ error: 'অননুমোদিত অ্যাক্সেস (Unauthorized)' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'কোনো ইমেজ ফাইল পাওয়া যায়নি।' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'শুধুমাত্র JPEG, PNG, WEBP, AVIF বা GIF ফরম্যাটের ছবি আপলোড করা যাবে।' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'ফাইলের আকার সর্বোচ্চ ৫ মেগাবাইট (5MB) হতে পারবে।' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine extension
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanExt = extension.replace(/[^a-z0-9]/g, '');
    const filename = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${cleanExt || 'jpg'}`;

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products');
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/products/${filename}`;

    return NextResponse.json({
      success: true,
      message: 'ছবি সফলভাবে আপলোড হয়েছে।',
      url: publicUrl,
      filename,
      size: file.size,
      mimeType: file.type,
    }, { status: 201 });
  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: error.message || 'ইমেজ আপলোড করতে সমস্যা হয়েছে।' },
      { status: 500 }
    );
  }
}
