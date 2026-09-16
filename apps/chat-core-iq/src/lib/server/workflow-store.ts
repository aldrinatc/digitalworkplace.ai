import { randomUUID } from 'node:crypto';
import { database, inTransaction } from './database';
import type { AppointmentConfig, RoutingRule } from '../workflow-matcher';
import type { Appointment } from '../workflows/appointment-flow';
import type { ServiceRequest } from '../workflows/service-request-flow';

export class WorkflowStoreError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const days = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];
type Row = Record<string, unknown>;
function config(
  row: Row,
): AppointmentConfig & { createdAt: string; updatedAt: string } {
  return {
    id: String(row.legacy_id || row.id),
    department: String(row.department),
    serviceName: String(row.service_name || row.department),
    description: String(row.description || ''),
    duration: Number(row.slot_duration || 30),
    availableDays: ((row.available_days as number[]) || []).map(
      (day) => days[day],
    ),
    timeSlots: (row.time_slots as AppointmentConfig['timeSlots']) || [],
    maxPerSlot: Number(row.max_per_slot || 1),
    leadTimeHours: Number(row.lead_time_hours ?? 24),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
function appointment(row: Row): Appointment {
  return {
    id: String(row.id),
    configId: String(row.config_key || row.config_id),
    userName: String(row.user_name),
    userEmail: String(row.user_email || ''),
    userPhone: String(row.user_phone || ''),
    date: String(row.date),
    timeSlot: String(row.time_slot),
    status: row.status as Appointment['status'],
    reason: String(row.reason || ''),
    notes: String(row.notes || ''),
    createdAt: String(row.created_at),
  };
}
export async function listAppointmentConfigs() {
  return (
    await database()`select * from dcq.appointment_config order by department, service_name`
  ).map(config);
}
export async function saveAppointmentConfig(
  value: AppointmentConfig & { id?: string },
) {
  if (
    !value.department?.trim() ||
    !value.serviceName?.trim() ||
    !Number.isInteger(value.duration) ||
    value.duration < 5 ||
    value.duration > 480 ||
    !Array.isArray(value.availableDays) ||
    value.availableDays.some((d) => !days.includes(d)) ||
    !Array.isArray(value.timeSlots) ||
    value.timeSlots.some(
      (s) =>
        !/^\d{2}:\d{2}$/.test(s.start) ||
        !/^\d{2}:\d{2}$/.test(s.end) ||
        s.start >= s.end,
    ) ||
    !Number.isInteger(value.maxPerSlot) ||
    value.maxPerSlot < 1 ||
    value.maxPerSlot > 100 ||
    value.leadTimeHours < 0
  ) {
    throw new WorkflowStoreError('Invalid appointment configuration');
  }
  const sql = database();
  const id = value.id || randomUUID();
  const existing =
    await sql`select id from dcq.appointment_config where id::text = ${id} or legacy_id = ${id}`;
  const row = {
    department: value.department,
    service_name: value.serviceName,
    description: value.description || '',
    slot_duration: value.duration,
    available_days: value.availableDays.map((d) => days.indexOf(d)),
    time_slots: sql.json(value.timeSlots),
    max_per_slot: value.maxPerSlot,
    lead_time_hours: value.leadTimeHours,
    is_active: value.isActive,
    updated_at: new Date(),
  };
  const rows = existing.length
    ? await sql`update dcq.appointment_config set ${sql(row)} where id = ${existing[0].id} returning *`
    : await sql`insert into dcq.appointment_config ${sql({ ...row, id: randomUUID(), legacy_id: id })} returning *`;
  return config(rows[0]);
}
export async function deactivateAppointmentConfig(id: string) {
  const rows =
    await database()`update dcq.appointment_config set is_active = false, updated_at = now() where id::text = ${id} or legacy_id = ${id} returning id`;
  return rows.length > 0;
}
export async function listAppointments() {
  const rows =
    await database()`select a.*, a.appointment_date::text as date, coalesce(c.legacy_id,c.id::text) as config_key
    from dcq.appointments a left join dcq.appointment_config c on c.id=a.config_id order by a.appointment_date,a.time_slot limit 1000`;
  return rows.map(appointment);
}
function slotsFor(c: AppointmentConfig) {
  const slots: string[] = [];
  for (const range of c.timeSlots) {
    const [h, m] = range.start.split(':').map(Number),
      [eh, em] = range.end.split(':').map(Number);
    for (let t = h * 60 + m; t + c.duration <= eh * 60 + em; t += c.duration)
      slots.push(
        `${Math.floor(t / 60)
          .toString()
          .padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`,
      );
  }
  return slots;
}
async function validConfig(id: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)))
    throw new WorkflowStoreError('Invalid appointment date');
  const rows =
    await database()`select * from dcq.appointment_config where (id::text=${id} or legacy_id=${id}) and is_active=true`;
  if (!rows.length)
    throw new WorkflowStoreError('Appointment service is unavailable', 404);
  const c = config(rows[0]);
  if (
    !c.availableDays.includes(days[new Date(date + 'T12:00:00Z').getUTCDay()])
  )
    throw new WorkflowStoreError('Service is unavailable on that day');
  return {
    c,
    uuid: String(rows[0].id),
    advance: Number(rows[0].advance_days || 30),
  };
}
export async function availableAppointmentSlots(
  id: string,
  date: string,
  excludeId = '',
) {
  const { c, uuid, advance } = await validConfig(id, date);
  const slots = slotsFor(c);
  if (!slots.length) return [];
  const rows =
    await database()`select slot from unnest(${slots}::text[]) as slot
    where (${date} || ' ' || slot)::timestamp at time zone 'America/New_York' >= now() + (${c.leadTimeHours} * interval '1 hour')
      and ${date}::date <= (now() at time zone 'America/New_York')::date + ${advance}::integer
      and (select count(*) from dcq.appointments where config_id=${uuid}::uuid and appointment_date=${date}::date and time_slot=slot
        and status <> 'cancelled' and id::text <> ${excludeId}) < ${c.maxPerSlot} order by slot`;
  return rows.map((r) => String(r.slot));
}
export async function reserveAppointment(
  value: Omit<Appointment, 'id' | 'createdAt'>,
) {
  return inTransaction(async () => {
    const sql = database();
    const { uuid } = await validConfig(value.configId, value.date);
    await sql`select pg_advisory_xact_lock(hashtextextended(${`booking:${uuid}:${value.date}:${value.timeSlot}`},0))`;
    if (
      !(await availableAppointmentSlots(value.configId, value.date)).includes(
        value.timeSlot,
      )
    )
      throw new WorkflowStoreError('Time slot is no longer available', 409);
    if (
      !value.userName?.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.userEmail) ||
      value.userName.length > 200
    )
      throw new WorkflowStoreError('Name and valid email are required');
    const rows =
      await sql`insert into dcq.appointments (config_id,user_name,user_email,user_phone,appointment_date,time_slot,status,reason,notes)
      values (${uuid}::uuid,${value.userName},${value.userEmail},${value.userPhone || ''},${value.date}::date,${value.timeSlot},${value.status},${value.reason || ''},${value.notes || ''})
      returning *, appointment_date::text as date`;
    return appointment({ ...rows[0], config_key: value.configId });
  });
}
export async function updateAppointmentRecord(
  id: string,
  updates: Partial<Appointment>,
) {
  return inTransaction(async () => {
    const sql = database();
    const rows =
      await sql`select a.*, appointment_date::text as date,coalesce(c.legacy_id,c.id::text) as config_key from dcq.appointments a left join dcq.appointment_config c on c.id=a.config_id where a.id::text=${id} for update of a`;
    if (!rows.length)
      throw new WorkflowStoreError('Appointment not found', 404);
    const old = appointment(rows[0]);
    const next = { ...old, ...updates, id };
    if (
      !['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show'].includes(
        next.status,
      )
    )
      throw new WorkflowStoreError('Invalid appointment status');
    let uuid = String(rows[0].config_id);
    if (
      next.status !== 'cancelled' &&
      (next.configId !== old.configId ||
        next.date !== old.date ||
        next.timeSlot !== old.timeSlot)
    ) {
      ({ uuid } = await validConfig(next.configId, next.date));
      await sql`select pg_advisory_xact_lock(hashtextextended(${`booking:${uuid}:${next.date}:${next.timeSlot}`},0))`;
      if (
        !(
          await availableAppointmentSlots(next.configId, next.date, id)
        ).includes(next.timeSlot)
      )
        throw new WorkflowStoreError('Time slot is no longer available', 409);
    }
    const updated =
      await sql`update dcq.appointments set config_id=${uuid}::uuid, user_name=${next.userName}, user_email=${next.userEmail}, user_phone=${next.userPhone},
      appointment_date=${next.date}::date,time_slot=${next.timeSlot},status=${next.status},reason=${next.reason},notes=${next.notes},updated_at=now() where id::text=${id} returning *,appointment_date::text as date`;
    return appointment({ ...updated[0], config_key: next.configId });
  });
}
function routingRule(row: Row): RoutingRule & { createdAt: string } {
  return {
    id: String(row.legacy_id || row.id),
    name: String(row.name || row.intent_pattern || ''),
    category: String(row.category || ''),
    keywords: (row.keywords as string[]) || [],
    targetDepartment: String(row.target_department || ''),
    priority: row.urgency as RoutingRule['priority'],
    slaHours: Number(row.sla_hours || 48),
    autoAssign: Boolean(row.auto_assign),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
  };
}
export async function listRoutingRules() {
  return (
    await database()`select * from dcq.workflow_routing order by created_at`
  ).map(routingRule);
}
export async function saveRoutingRule(value: RoutingRule) {
  if (
    !value.name?.trim() ||
    !value.category?.trim() ||
    !value.targetDepartment?.trim() ||
    !Array.isArray(value.keywords) ||
    !['low', 'medium', 'high', 'urgent'].includes(value.priority)
  )
    throw new WorkflowStoreError('Invalid routing rule');
  const sql = database();
  const id = value.id || randomUUID();
  const existing =
    await sql`select id from dcq.workflow_routing where id::text=${id} or legacy_id=${id}`;
  const row = {
    name: value.name,
    category: value.category,
    keywords: value.keywords,
    target_department: value.targetDepartment,
    urgency: value.priority,
    sla_hours: value.slaHours,
    auto_assign: value.autoAssign,
    is_active: value.isActive,
  };
  const rows = existing.length
    ? await sql`update dcq.workflow_routing set ${sql(row)} where id=${existing[0].id} returning *`
    : await sql`insert into dcq.workflow_routing ${sql({ ...row, id: randomUUID(), legacy_id: id })} returning *`;
  return routingRule(rows[0]);
}
export async function deactivateRoutingRule(id: string) {
  return (
    (
      await database()`update dcq.workflow_routing set is_active=false where id::text=${id} or legacy_id=${id} returning id`
    ).length > 0
  );
}
export async function persistServiceRequest(
  value: Omit<ServiceRequest, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const reference = `SR-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const rows =
    await database()`insert into dcq.service_requests (request_number,category,department,description,location,priority,status,reporter_name,reporter_email,reporter_phone,sla_hours)
    values (${reference},${value.category},${value.department},${value.description},${value.location || ''},${value.priority},'submitted',${value.userName || ''},${value.userEmail || ''},${value.userPhone || ''},${value.slaHours}) returning created_at,updated_at`;
  return {
    ...value,
    id: reference,
    createdAt: String(rows[0].created_at),
    updatedAt: String(rows[0].updated_at),
  };
}
