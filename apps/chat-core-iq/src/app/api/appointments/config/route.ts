import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/api-auth';
import {
  listAppointmentConfigs,
  saveAppointmentConfig,
  deactivateAppointmentConfig,
  WorkflowStoreError,
} from '@/lib/server/workflow-store';
export const dynamic = 'force-dynamic';
function failed(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof WorkflowStoreError
          ? error.message
          : 'Appointment configuration is unavailable',
    },
    { status: error instanceof WorkflowStoreError ? error.status : 503 },
  );
}
export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams;
    let configs = await listAppointmentConfigs();
    if (p.get('activeOnly') === 'true')
      configs = configs.filter((c) => c.isActive);
    if (p.get('department'))
      configs = configs.filter((c) => c.department === p.get('department'));
    return NextResponse.json(configs);
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
      await saveAppointmentConfig({
        ...body,
        id: undefined,
        isActive: true,
        maxPerSlot: body.maxPerSlot ?? 1,
        leadTimeHours: body.leadTimeHours ?? 24,
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
    const body = await request.json();
    const old = (await listAppointmentConfigs()).find((c) => c.id === body.id);
    if (!old) throw new WorkflowStoreError('Configuration not found', 404);
    return NextResponse.json(await saveAppointmentConfig({ ...old, ...body }));
  } catch (error) {
    return failed(error);
  }
}
export async function DELETE(request: NextRequest) {
  const denied = await validateAdminRequest(request);
  if (denied) return denied;
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) throw new WorkflowStoreError('Configuration ID required');
    if (!(await deactivateAppointmentConfig(id)))
      throw new WorkflowStoreError('Configuration not found', 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    return failed(error);
  }
}
