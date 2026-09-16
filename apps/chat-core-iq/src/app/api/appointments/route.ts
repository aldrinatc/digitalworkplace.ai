import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/api-auth';
import {
  listAppointments,
  reserveAppointment,
  updateAppointmentRecord,
  WorkflowStoreError,
} from '@/lib/server/workflow-store';
export const dynamic = 'force-dynamic';
function failed(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof WorkflowStoreError
          ? error.message
          : 'Appointment storage is unavailable',
    },
    { status: error instanceof WorkflowStoreError ? error.status : 503 },
  );
}
export async function GET(request: NextRequest) {
  const denied = await validateAdminRequest(request);
  if (denied) return denied;
  try {
    const p = request.nextUrl.searchParams;
    const appointments = (await listAppointments()).filter(
      (a) =>
        (!p.get('status') || a.status === p.get('status')) &&
        (!p.get('configId') || a.configId === p.get('configId')) &&
        (!p.get('date') || a.date === p.get('date')) &&
        (!p.get('dateFrom') || a.date >= p.get('dateFrom')!) &&
        (!p.get('dateTo') || a.date <= p.get('dateTo')!),
    );
    return NextResponse.json({ appointments, total: appointments.length });
  } catch (error) {
    return failed(error);
  }
}
export async function POST(request: NextRequest) {
  const denied = await validateAdminRequest(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    return NextResponse.json(
      await reserveAppointment({
        ...body,
        status: 'scheduled',
        reason: body.reason || '',
        notes: '',
      }),
      { status: 201 },
    );
  } catch (error) {
    return failed(error);
  }
}
export async function PUT(request: NextRequest) {
  const denied = await validateAdminRequest(request);
  if (denied) return denied;
  try {
    const { id, ...updates } = await request.json();
    if (typeof id !== 'string')
      throw new WorkflowStoreError('Appointment ID required');
    return NextResponse.json(await updateAppointmentRecord(id, updates));
  } catch (error) {
    return failed(error);
  }
}
export async function DELETE(request: NextRequest) {
  const denied = await validateAdminRequest(request);
  if (denied) return denied;
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) throw new WorkflowStoreError('Appointment ID required');
    await updateAppointmentRecord(id, { status: 'cancelled' });
    return NextResponse.json({ success: true });
  } catch (error) {
    return failed(error);
  }
}
