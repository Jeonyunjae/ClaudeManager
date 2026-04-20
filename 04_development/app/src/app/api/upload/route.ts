import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { logError } from '@/lib/error-logger';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [
  '.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.ts', '.tsx', '.js', '.jsx', '.py', '.sh', '.sql',
  '.log', '.env', '.toml', '.ini', '.cfg',
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Authentication required.' } },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_REQUIRED', message: 'File is required.' } },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_SIZE', message: 'File exceeds 10MB limit.' } },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_TYPE', message: `File type "${ext}" is not allowed.` } },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    // Generate unique filename
    const fileId = uuidv4();
    const safeFilename = `${fileId}${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeFilename);

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      data: {
        id: fileId,
        filename: file.name,
        storedName: safeFilename,
        path: filePath,
        size: file.size,
        type: file.type,
        ext,
      },
    });
  } catch (error) {
    logError(error, { requestPath: '/api/upload' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Upload failed.' } },
      { status: 500 }
    );
  }
}
