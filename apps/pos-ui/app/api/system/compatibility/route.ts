import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const response = NextResponse.json({
    apiVersion: '1.0.0',
    minWaiterVersion: '1.0.0',
    minCustomerVersion: '1.0.0',
    serverTimestamp: new Date().toISOString(),
    status: 'COMPATIBLE',
  });

  response.headers.set('X-ChayaOne-API-Version', '1.0.0');
  response.headers.set('X-ChayaOne-Min-Waiter-Version', '1.0.0');
  response.headers.set('X-ChayaOne-Min-Customer-Version', '1.0.0');

  return response;
}
