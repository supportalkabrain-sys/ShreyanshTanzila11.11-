import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { password, storedHash } = await req.json();

    if (!password || !storedHash) {
      return NextResponse.json({ success: false, error: 'Password is required' }, { status: 400 });
    }

    const computedHash = crypto.createHash('sha256').update(password.trim()).digest('hex');

    if (computedHash === storedHash) {
      // Generate a short-lived verification token
      const token = crypto.randomBytes(16).toString('hex');
      return NextResponse.json({
        success: true,
        token,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Incorrect room password. Please try again.',
      }, { status: 401 });
    }
  } catch (error) {
    console.error('Password verify error:', error);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
