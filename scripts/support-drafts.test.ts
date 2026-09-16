import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { prisma } from '../apps/support-iq/src/lib/prisma';
import * as drafts from '../apps/support-iq/src/app/api/drafts/route';
import * as detail from '../apps/support-iq/src/app/api/drafts/[id]/route';
import * as approve from '../apps/support-iq/src/app/api/drafts/[id]/approve/route';
import * as reject from '../apps/support-iq/src/app/api/drafts/[id]/reject/route';
const url=process.env.DATABASE_URL;
if(!url || new URL(url).hostname!=='127.0.0.1'||new URL(url).pathname!=='/dwp_recovery')throw new Error('Isolated local test database required');
let token:string;let draftId:string;
const originalFetch=globalThis.fetch;
const request=(path:string,method='GET',body?:unknown,auth=true)=>new NextRequest(`https://dsq.digitalworkplace.ai/dsq/api/drafts${path}`,{method,headers:{'content-type':'application/json',...(auth?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
test.before(async()=>{
 const {publicKey,privateKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);
 globalThis.fetch=async input=>{const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;assert.equal(url,'https://clerk.digitalworkplace.ai/.well-known/jwks.json');return Response.json({keys:[{...jwk,kid:'synthetic',alg:'RS256',use:'sig'}]});};
 token=await new SignJWT({azp:'https://dsq.digitalworkplace.ai'}).setProtectedHeader({alg:'RS256',kid:'synthetic'}).setIssuer('https://clerk.digitalworkplace.ai').setSubject('synthetic-clerk').setIssuedAt().setExpirationTime('5m').sign(privateKey);
 await prisma.$executeRaw`INSERT INTO public.users(id,clerk_id,role) VALUES ('00000000-0000-4000-8000-000000000001','synthetic-clerk','super_admin') ON CONFLICT(id) DO UPDATE SET clerk_id='synthetic-clerk',role='super_admin'`;
});
test.after(async()=>{globalThis.fetch=originalFetch;await prisma.$disconnect();});
test('draft endpoints reject unsigned requests and forged origins',async()=>{
 assert.equal((await drafts.GET(request('', 'GET',undefined,false))).status,401);
 const r=request('');r.headers.set('origin','https://untrusted.example');assert.equal((await drafts.GET(r)).status,403);
});
test('manual draft persists with a version and single-status filtering works',async()=>{
 const r=await drafts.POST(request('', 'POST',{ticketId:'synthetic-ticket-2',ticketSubject:'Synthetic request',originalContent:'Synthetic text',draftContent:'Synthetic draft'}));
 assert.equal(r.status,200);const body=await r.json();assert.equal(body.success,true);draftId=body.draft.id;assert.equal(body.draft.versions.length,1);
 const list=await (await drafts.GET(request('?status=PENDING_REVIEW'))).json();assert.equal(list.success,true);assert.ok(list.drafts.some((d:{id:string})=>d.id===draftId));
});
test('editing creates a saved version and approval persists reviewed content',async()=>{
 const context={params:Promise.resolve({id:draftId})};
 const edited=await (await detail.PATCH(request(`/${draftId}`,'PATCH',{draftContent:'Synthetic edited reply',editedBy:'synthetic-reviewer'}),context)).json();assert.equal(edited.success,true);assert.equal(edited.draft.versions.length,2);
 const approved=await (await approve.POST(request(`/${draftId}/approve`,'POST',{approvedById:'synthetic-reviewer',finalContent:'Synthetic approved reply'}),context)).json();assert.equal(approved.success,true);assert.equal(approved.draft.status,'APPROVED');assert.equal(approved.draft.finalContent,'Synthetic approved reply');
 const invalid=await reject.POST(request(`/${draftId}/reject`,'POST',{reviewedById:'synthetic-reviewer',rejectionReason:'Synthetic'}),context);assert.equal(invalid.status,400);
});
