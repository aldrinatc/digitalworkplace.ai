import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/api-auth';
import {
  listRoutingRules,
  saveRoutingRule,
  deactivateRoutingRule,
  WorkflowStoreError,
} from '@/lib/server/workflow-store';
export const dynamic = 'force-dynamic';
function failed(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof WorkflowStoreError
          ? error.message
          : 'Routing configuration is unavailable',
    },
    { status: error instanceof WorkflowStoreError ? error.status : 503 },
  );
}
export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams;
    let rules = await listRoutingRules();
    if (p.get('activeOnly') === 'true') rules = rules.filter((r) => r.isActive);
    if (p.get('department'))
      rules = rules.filter((r) => r.targetDepartment === p.get('department'));
    if (p.get('category'))
      rules = rules.filter((r) => r.category === p.get('category'));
    return NextResponse.json(rules);
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
      await saveRoutingRule({
        ...body,
        id: undefined,
        keywords: body.keywords || [],
        priority: body.priority || 'medium',
        slaHours: body.slaHours ?? 48,
        autoAssign: body.autoAssign ?? false,
        isActive: true,
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
    const old = (await listRoutingRules()).find((r) => r.id === body.id);
    if (!old) throw new WorkflowStoreError('Routing rule not found', 404);
    return NextResponse.json(await saveRoutingRule({ ...old, ...body }));
  } catch (error) {
    return failed(error);
  }
}
export async function DELETE(request: NextRequest) {
  const denied = await validateAdminRequest(request);
  if (denied) return denied;
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) throw new WorkflowStoreError('Routing rule ID required');
    if (!(await deactivateRoutingRule(id)))
      throw new WorkflowStoreError('Routing rule not found', 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    return failed(error);
  }
}
