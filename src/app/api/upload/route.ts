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

async function uploadToSupabaseStorage(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const bucketName = 'product-images';

  const doUpload = async () => {
    return await fetch(`${supabaseUrl}/storage/v1/object/${bucketName}/${filename}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: new Uint8Array(buffer),
    });
  };

  let res = await doUpload();

  // If bucket does not exist, auto-create public bucket and retry
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const isNotFound =
      res.status === 404 ||
      (typeof errorBody?.message === 'string' && errorBody.message.toLowerCase().includes('bucket not found'));

    if (isNotFound) {
      const createRes = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: bucketName,
          name: bucketName,
          public: true,
          file_size_limit: 10485760,
        }),
      });

      if (createRes.ok) {
        res = await doUpload();
      }
    }
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData.message || errData.error || `Supabase Storage upload failed with status ${res.status}`
    );
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${filename}`;
}

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

    let publicUrl: string | null = null;

    // 1. Primary: Upload to Supabase Storage (required for Vercel / serverless environments)
    if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
      try {
        publicUrl = await uploadToSupabaseStorage(buffer, filename, file.type);
      } catch (storageError: any) {
        console.error('Supabase Storage upload error:', storageError);
        // If Supabase failed and we are on Vercel, rethrow error to avoid read-only fs crash
        if (process.env.VERCEL) {
          throw storageError;
        }
      }
    }

    // 2. Fallback: Local filesystem for offline local development
    if (!publicUrl) {
      if (process.env.VERCEL) {
        return NextResponse.json(
          {
            error:
              'Vercel-এ ফাইল সেভ করার জন্য Supabase Storage প্রয়োজন। দয়া করে Vercel Dashboard -> Environment Variables-এ SUPABASE_URL এবং SUPABASE_SERVICE_ROLE_KEY যুক্ত করুন।',
          },
          { status: 500 }
        );
      }

      try {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products');
        await mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, filename);
        await writeFile(filePath, buffer);

        publicUrl = `/uploads/products/${filename}`;
      } catch (fsErr: any) {
        console.error('Local filesystem upload failed:', fsErr);
        return NextResponse.json(
          {
            error:
              'ফাইল সেভ করা যায়নি। Vercel সার্ভারলেস এনভায়রনমেন্টে SUPABASE_URL ও SUPABASE_SERVICE_ROLE_KEY কনফিগার করুন।',
          },
          { status: 500 }
        );
      }
    }

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

