// Seed ATS demo state for the walkthrough video.
// Run before every render (idempotent — upserts everything).
// 1. Renames org to "In-sync demo"
// 2. Creates org admin: Siddharth Roy (org_admin / admin)
// 3. Creates 3 demo recruiter profiles (manager / member)
// 4. Creates Priya Sharma's full journey: apply -> AI score -> Bolna call -> onboarding
// 5. Creates supporting call/candidate activity so dashboards look populated
// Writes seed-state.json with IDs scenes.mjs needs.
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadEnv } from './lib/env.mjs';

const env = loadEnv(new URL('../.env', import.meta.url));
const here = dirname(fileURLToPath(import.meta.url));

const SB_URL = 'https://htdwkhtfdifwajdkkpul.supabase.co';
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const sb = createClient(SB_URL, SB_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// REST helper using service role key
async function rest(method, path, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const get = (p) => rest('GET', p);
const post = (p, b) => rest('POST', p, b);
const patch = (p, b) => rest('PATCH', p, b);
const upsert = (p, b, conflict) => fetch(`${SB_URL}/rest/v1/${p}${conflict ? `?on_conflict=${conflict}` : ''}`, {
  method: 'POST',
  headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify(b),
}).then(async r => { const t = await r.text(); if (!r.ok) throw new Error(`UPSERT ${p} -> ${r.status}: ${t}`); return t ? JSON.parse(t) : null; });

// ── Constants ─────────────────────────────────────────────────────────────────
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_PASSWORD = 'AtsDemo#2026';

// ── 1. Rename org to "In-sync demo" ──────────────────────────────────────────
console.log('Updating org name to "In-sync demo"...');
await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${ORG_ID}`, {
  method: 'PATCH',
  headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
  body: JSON.stringify({ name: 'In-sync demo', slug: 'in-sync-demo' }),
});
console.log('  done');

// ── 2. Org admin: Siddharth Roy ───────────────────────────────────────────────
console.log('\nCreating org admin: Siddharth Roy...');
const ORG_ADMIN_EMAIL = 'siddharth.roy@insync-demo.in';
const { data: allUsers } = await sb.auth.admin.listUsers();
const foundOrgAdmin = allUsers?.users?.find(u => u.email === ORG_ADMIN_EMAIL);
let ORG_ADMIN_ID;
if (foundOrgAdmin) {
  ORG_ADMIN_ID = foundOrgAdmin.id;
  await sb.auth.admin.updateUserById(ORG_ADMIN_ID, { password: DEMO_PASSWORD });
  console.log(`  existing: ${ORG_ADMIN_ID} — password refreshed`);
} else {
  const { data: created, error: cErr } = await sb.auth.admin.createUser({
    email: ORG_ADMIN_EMAIL, password: DEMO_PASSWORD, email_confirm: true,
    user_metadata: { full_name: 'Siddharth Roy' },
  });
  if (cErr) throw new Error(`Create org admin: ${cErr.message}`);
  ORG_ADMIN_ID = created.user.id;
  console.log(`  created: ${ORG_ADMIN_ID}`);
}
await upsert('profiles', { id: ORG_ADMIN_ID, email: ORG_ADMIN_EMAIL, full_name: 'Siddharth Roy', onboarding_completed: true, org_id: ORG_ID }, 'id');
await upsert('org_memberships', { org_id: ORG_ID, user_id: ORG_ADMIN_ID, role: 'org_admin' }, 'org_id,user_id');
await upsert('user_roles', { user_id: ORG_ADMIN_ID, role: 'admin', org_id: ORG_ID }, 'user_id,role');
console.log(`  Siddharth Roy: org_admin + admin role`);

// ── 3. Demo recruiter profiles ────────────────────────────────────────────────
console.log('\nCreating demo recruiter profiles...');

const RECRUITERS = [
  { email: 'aarav.mehta@insync-demo.in', full_name: 'Aarav Mehta', phone: '9811234560' },
  { email: 'neha.kapoor@insync-demo.in', full_name: 'Neha Kapoor',  phone: '9822345671' },
  { email: 'divya.rao@insync-demo.in',   full_name: 'Divya Rao',    phone: '9833456782' },
];

const recruiterIds = [];
for (const rec of RECRUITERS) {
  const { data: existingU } = await sb.auth.admin.listUsers();
  const found = existingU?.users?.find(u => u.email === rec.email);
  let uid;
  if (found) {
    uid = found.id;
    await sb.auth.admin.updateUserById(uid, { password: DEMO_PASSWORD });
    console.log(`  ${rec.full_name}: refreshed password`);
  } else {
    const { data: created, error: cErr } = await sb.auth.admin.createUser({
      email: rec.email, password: DEMO_PASSWORD, email_confirm: true,
      user_metadata: { full_name: rec.full_name },
    });
    if (cErr) { console.warn(`  ${rec.full_name}: create error: ${cErr.message}`); continue; }
    uid = created.user.id;
    console.log(`  ${rec.full_name}: created ${uid}`);
  }
  recruiterIds.push({ ...rec, id: uid });

  await upsert('profiles', { id: uid, email: rec.email, full_name: rec.full_name, phone: rec.phone, onboarding_completed: true, org_id: ORG_ID }, 'id');
  await upsert('org_memberships', { org_id: ORG_ID, user_id: uid, role: 'member' }, 'org_id,user_id');
  await upsert('user_roles', { user_id: uid, role: 'manager', org_id: ORG_ID }, 'user_id,role');
}

// Aarav Mehta will be Priya's assigned recruiter
const AARAV_ID = recruiterIds.find(r => r.full_name === 'Aarav Mehta')?.id || recruiterIds[0].id;

// ── 4. Demo client ────────────────────────────────────────────────────────────
console.log('\nUpserting demo client...');
const existingClients = await get(`clients?company_name=eq.TechCorp+Solutions&org_id=eq.${ORG_ID}&select=id`);
let clientId;
if (existingClients?.length > 0) {
  clientId = existingClients[0].id;
  console.log(`  existing: ${clientId}`);
} else {
  const r = await post('clients', {
    company_name: 'TechCorp Solutions', contact_name: 'Rohan Kapoor', contact_number: '9900112233',
    email_id: 'hiring@techcorp.in', industry_sector: 'Technology',
    head_office_location: 'Whitefield, Bangalore 560066',
    org_id: ORG_ID, created_by: ORG_ADMIN_ID,
  });
  clientId = r[0].id;
  console.log(`  created: ${clientId}`);
}

// ── 5. Demo mandate ───────────────────────────────────────────────────────────
console.log('Upserting demo mandate...');
const existingMandates = await get(`mandates?job_title=eq.Senior+Frontend+Developer&org_id=eq.${ORG_ID}&select=id`);
let mandateId;
if (existingMandates?.length > 0) {
  mandateId = existingMandates[0].id;
  await patch(`mandates?id=eq.${mandateId}`, { assigned_recruiter_id: AARAV_ID });
  console.log(`  existing: ${mandateId} — recruiter refreshed`);
} else {
  const r = await post('mandates', {
    job_title: 'Senior Frontend Developer', client_id: clientId,
    job_location: 'Bangalore', employment_type: 'permanent', work_mode: 'hybrid',
    number_of_positions: 3, min_experience_years: 3, max_experience_years: 7,
    min_ctc_lakhs: 8, max_ctc_lakhs: 18,
    mandatory_skills: ['React', 'TypeScript', 'Node.js'],
    minimum_qualification: 'B.Tech / B.E.',
    job_description: 'Looking for a Senior Frontend Developer to build and maintain scalable web applications using React and TypeScript.',
    priority_level: 'High', mandate_status: 'open',
    mandate_received_date: new Date().toISOString().split('T')[0],
    target_closure_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    assigned_recruiter_id: AARAV_ID, org_id: ORG_ID, created_by: ORG_ADMIN_ID,
  });
  mandateId = r[0].id;
  console.log(`  created: ${mandateId}`);
}

// ── 6. Priya Sharma (the demo candidate) ──────────────────────────────────────
console.log('\nUpserting Priya Sharma...');
const existingPriya = await get(`candidates?email=eq.priya.sharma.demo%40gmail.com&org_id=eq.${ORG_ID}&select=id`);
let candidateId;
if (existingPriya?.length > 0) {
  candidateId = existingPriya[0].id;
  await patch(`candidates?id=eq.${candidateId}`, {
    interview_stage: 'Interview', current_status: 'applied', is_onboarded: false,
    assigned_recruiter: AARAV_ID,
  });
  console.log(`  refreshed: ${candidateId}`);
} else {
  const r = await post('candidates', {
    first_name: 'Priya', last_name: 'Sharma',
    email: 'priya.sharma.demo@gmail.com', phone: '9876543210',
    designation: 'Frontend Developer',
    current_ctc_lakhs: 8.0, expected_ctc_lakhs: 12.0,
    interview_stage: 'Interview', current_status: 'applied',
    source: 'Referral',
    location: 'Bangalore', city: 'Bangalore', state: 'Karnataka',
    org_id: ORG_ID, assigned_recruiter: AARAV_ID, created_by: ORG_ADMIN_ID, is_onboarded: false,
  });
  candidateId = r[0].id;
  console.log(`  created: ${candidateId}`);
}

// ── 7. AI score for Priya ─────────────────────────────────────────────────────
console.log('Upserting AI score...');
await upsert('candidate_ai_scores', {
  candidate_id: candidateId, org_id: ORG_ID, score: 61, category: 'promising',
  breakdown: { interview_stage: 23, call_engagement: 15, profile_completeness: 16, application_quality: 7 },
  reasoning: 'Candidate has progressed to the offer stage with a solid profile and referral-sourced application indicating genuine interest. Call engagement is positive and skills align well to the mandate.',
  scored_at: new Date().toISOString(),
}, 'candidate_id');

// ── 8. Bolna call log for Priya ───────────────────────────────────────────────
console.log('Upserting Bolna call log...');
const existingCalls = await get(`call_logs?demandcom_id=eq.${candidateId}&call_method=eq.bolna&select=id`);
const callAnalysis = {
  summary: 'Actively exploring opportunities. CTC 8L current, 12L expected. 30-day notice (negotiable). Open to hybrid in Bangalore. Engaged and positive throughout.',
  next_step: 'Send formal offer letter', interest_level: 'high', expected_ctc: 1200000, notice_period_days: 30,
};
const transcript = `Agent: Hi, may I speak with Priya?
Priya: Yes, speaking.
Agent: Hi Priya, I'm calling from In-Sync regarding the Senior Frontend Developer position at TechCorp Solutions. Do you have a few minutes?
Priya: Yes of course, go ahead.
Agent: Are you currently open to new opportunities?
Priya: Yes, I have been exploring for a while now.
Agent: What is your current CTC?
Priya: I'm at eight lakhs currently.
Agent: And expected CTC for the right role?
Priya: Twelve to thirteen lakhs.
Agent: Your notice period?
Priya: Thirty days, but negotiable. I can try for an early release.
Agent: The role is hybrid from Bangalore. Is that comfortable?
Priya: Yes absolutely, I'm based in Bangalore.
Agent: Excellent. We'll share the offer details by email shortly. Thank you Priya.
Priya: Thank you, looking forward to it.`;
const callNow = new Date();
const callStart = new Date(callNow.getTime() - 2 * 3600000);
const callEnd = new Date(callStart.getTime() + 305000);
if (existingCalls?.length) {
  await patch(`call_logs?id=eq.${existingCalls[0].id}`, {
    status: 'completed', conversation_duration: 305, transcript, analysis_json: callAnalysis,
    analysis_quality_score: 82, start_time: callStart.toISOString(), end_time: callEnd.toISOString(),
  });
} else {
  await post('call_logs', {
    demandcom_id: candidateId, org_id: ORG_ID, from_number: 'bolna-ai', to_number: '9876543210',
    status: 'completed', direction: 'outbound-api', call_method: 'bolna',
    bolna_execution_id: `demo-exec-${candidateId.slice(0,8)}`,
    conversation_duration: 305, transcript, analysis_json: callAnalysis, analysis_quality_score: 82,
    start_time: callStart.toISOString(), end_time: callEnd.toISOString(), initiated_by: AARAV_ID,
  });
}

// ── 9. Supporting candidate activity for each demo recruiter ──────────────────
console.log('\nCreating recruiter activity...');
const STAGES = ['Screening', 'Interview', 'Offer', 'Selected', 'Rejected'];
const NAMES = [
  ['Rahul','Verma'],['Ananya','Iyer'],['Suresh','Nair'],['Priyanka','Ghosh'],
  ['Kiran','Bhat'],['Meera','Pillai'],['Deepak','Joshi'],['Shreya','Malik'],
  ['Arun','Kumar'],['Divya','Patel'],['Sanjay','Rao'],['Pooja','Singh'],
  ['Vijay','Das'],['Lakshmi','Krishnan'],['Rohit','Shetty'],
];
let nameIdx = 0;
let phoneIdx = 0;
const now = new Date();

for (const recruiter of recruiterIds) {
  const count = { aarav: 6, neha: 5, divya: 4 }[recruiter.full_name.split(' ')[0].toLowerCase()] || 5;
  const callCount = { aarav: 18, neha: 14, divya: 9 }[recruiter.full_name.split(' ')[0].toLowerCase()] || 10;

  for (let i = 0; i < count; i++) {
    const [fn, ln] = NAMES[nameIdx++ % NAMES.length];
    const stage = STAGES[Math.min(i, STAGES.length - 1)];
    const existing = await get(`candidates?email=eq.${fn.toLowerCase()}.${ln.toLowerCase()}.demo%40ats-demo.in&org_id=eq.${ORG_ID}&select=id`);
    let cid;
    if (existing?.length) {
      cid = existing[0].id;
      await patch(`candidates?id=eq.${cid}`, { interview_stage: stage });
    } else {
      const r = await post('candidates', {
        first_name: fn, last_name: ln,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}.demo@ats-demo.in`,
        phone: `9880${String(phoneIdx++).padStart(6, '0')}`,
        designation: i % 2 === 0 ? 'Software Engineer' : 'Business Analyst',
        current_ctc_lakhs: 6 + i, expected_ctc_lakhs: 9 + i,
        interview_stage: stage, current_status: 'applied',
        source: ['Referral','Job Portal','LinkedIn','Walk-in'][i % 4],
        org_id: ORG_ID, assigned_recruiter: recruiter.id, created_by: recruiter.id,
        created_at: new Date(now.getTime() - i * 2 * 86400000).toISOString(),
      });
      cid = r[0].id;
    }

    const calls = Math.min(callCount, 3);
    for (let c = 0; c < calls; c++) {
      const st = new Date(now.getTime() - (i * 2 + c) * 86400000 - 3600000);
      const et = new Date(st.getTime() + (90 + c * 30) * 1000);
      const existing2 = await get(`call_logs?demandcom_id=eq.${cid}&initiated_by=eq.${recruiter.id}&select=id`);
      if (!existing2?.length) {
        await post('call_logs', {
          demandcom_id: cid, org_id: ORG_ID, from_number: '08039591920',
          to_number: `977${String(10000000 + phoneIdx).slice(1)}`,
          status: c === 0 ? 'completed' : ['completed','no-answer'][c % 2],
          direction: 'outbound-api', call_method: 'phone', call_sid: `demo-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          conversation_duration: 90 + c * 30,
          start_time: st.toISOString(), end_time: et.toISOString(), initiated_by: recruiter.id,
        });
      }
    }
  }
  console.log(`  ${recruiter.full_name}: ${count} candidates, ${callCount} calls`);
}

// ── 10. Onboarding form ────────────────────────────────────────────────────────
console.log('\nUpserting onboarding form...');
const existingForms = await get(`onboarding_forms?org_id=eq.${ORG_ID}&is_active=eq.true&select=id,slug`);
let formId, formSlug;
if (existingForms?.length) {
  formId = existingForms[0].id; formSlug = existingForms[0].slug;
  console.log(`  existing: ${formId} slug=${formSlug}`);
} else {
  formSlug = `onboard-insync-2026`;
  const r = await post('onboarding_forms', {
    org_id: ORG_ID, title: 'New Hire Onboarding',
    description: 'Please fill in your details and upload the required documents to complete your onboarding.',
    slug: formSlug, is_active: true, created_by: ORG_ADMIN_ID,
  });
  formId = r[0].id;
  console.log(`  created: ${formId} slug=${formSlug}`);
}

// ── 11. Onboarding submission for Priya ───────────────────────────────────────
console.log('Upserting onboarding submission...');
const aiReview = {
  risk_score: 12, recommendation: 'Approve',
  findings: ['PAN format valid (ABCPS1234F)', 'Aadhaar format valid (12 digits)', 'IFSC HDFC0001234 is valid', 'Bank account complete', 'No fraud signals detected'],
  summary: 'All documents appear complete and valid. Identity details internally consistent. Recommend approval.',
};
const existingSubs = await get(`onboarding_submissions?candidate_id=eq.${candidateId}&select=id`);
if (existingSubs?.length) {
  await patch(`onboarding_submissions?id=eq.${existingSubs[0].id}`, {
    status: 'documents_under_review', ai_review_result: aiReview, ai_review_at: new Date().toISOString(),
  });
} else {
  await post('onboarding_submissions', {
    form_id: formId, org_id: ORG_ID, candidate_id: candidateId,
    full_name: 'Priya Sharma', gender: 'Female', date_of_birth: '1998-03-15',
    marital_status: 'Single', blood_group: 'B+',
    qualifications: 'B.Tech Computer Science, VIT University, 2020',
    contact_number: '9876543210', personal_email: 'priya.sharma.demo@gmail.com', email_verified: true,
    pan_number: 'ABCPS1234F', aadhar_number: '123456789012', uan_number: '',
    father_name: 'Rajesh Sharma', mother_name: 'Sunita Sharma', emergency_contact_number: '9812345678',
    present_address: '42 Koramangala 5th Block, Bangalore 560095',
    permanent_address: '12 Civil Lines, Jaipur 302006',
    bank_name: 'HDFC Bank', account_number: '50100987654321',
    ifsc_code: 'HDFC0001234', branch_name: 'Koramangala Branch',
    status: 'documents_under_review', ai_review_result: aiReview, ai_review_at: new Date().toISOString(),
  });
}

// ── 12. mandate_candidates — link candidates to mandate for pipeline chart ──────
console.log('\nUpserting mandate_candidates...');
// Map interview_stage values to mandate_candidates current_stage values
const stageMap = {
  'Screening': 'shortlisted', 'Interview': 'interview',
  'Offer': 'offer', 'Selected': 'selected', 'Rejected': 'rejected',
};
// Include Priya + all recruiter candidates for the demo mandate
const allCandidates = await get(`candidates?org_id=eq.${ORG_ID}&select=id,interview_stage,assigned_recruiter&limit=50`);
let mcCount = 0;
for (const cand of (allCandidates || [])) {
  const stage = stageMap[cand.interview_stage] || 'shortlisted';
  const status = cand.interview_stage === 'Rejected' ? 'inactive' : 'active';
  const existing = await get(`mandate_candidates?mandate_id=eq.${mandateId}&candidate_id=eq.${cand.id}&select=id`);
  if (!existing?.length) {
    try {
      await post('mandate_candidates', {
        mandate_id: mandateId, candidate_id: cand.id,
        current_stage: stage, status,
        created_by: cand.assigned_recruiter || ORG_ADMIN_ID,
      });
      mcCount++;
    } catch (e) { console.warn(`  mandate_candidates skip: ${e.message.split('\n')[0]}`); }
  }
}
console.log(`  linked ${mcCount} candidates to mandate`);

// ── 13. Demo team (Talent Acquisition Alpha) ──────────────────────────────────
console.log('\nUpserting demo team...');
const existingTeam = await get(`teams?name=eq.Talent+Acquisition+Alpha&org_id=eq.${ORG_ID}&select=id`);
let teamId;
if (existingTeam?.length) {
  teamId = existingTeam[0].id;
  console.log(`  existing team: ${teamId}`);
} else {
  const r = await post('teams', {
    name: 'Talent Acquisition Alpha', description: 'Core recruiting team for tech mandates',
    team_lead_id: ORG_ADMIN_ID, is_active: true, org_id: ORG_ID, created_by: ORG_ADMIN_ID,
  });
  teamId = r[0].id;
  console.log(`  created team: ${teamId}`);
}
// Add Siddharth, Aarav, Neha, Divya as team members
for (const uid of [ORG_ADMIN_ID, ...recruiterIds.map(r => r.id)]) {
  const role = uid === ORG_ADMIN_ID ? 'member' : 'member';
  const existing = await get(`team_members?team_id=eq.${teamId}&user_id=eq.${uid}&select=id`);
  if (!existing?.length) {
    await post('team_members', { team_id: teamId, user_id: uid, role_in_team: role, is_active: true });
  }
}
console.log(`  team members added`);

// ── 14. Candidates assigned to Siddharth Roy (My Desk demo) ──────────────────
console.log('\nUpserting My Desk candidates for Siddharth Roy...');
const MY_DESK_NAMES = [
  ['Arjun','Sethi','Tech Lead',10,16,'Interview', true],
  ['Sunita','Menon','Product Manager',12,18,'Offer', false],
  ['Ravi','Bose','Backend Developer',7,11,'Shortlisted', false],
];
for (const [fn, ln, desig, cur, exp, stage, callToday] of MY_DESK_NAMES) {
  const email = `${fn.toLowerCase()}.${ln.toLowerCase()}.sid@ats-demo.in`;
  const existing = await get(`candidates?email=eq.${encodeURIComponent(email)}&org_id=eq.${ORG_ID}&select=id`);
  if (existing?.length) {
    await patch(`candidates?id=eq.${existing[0].id}`, {
      interview_stage: stage, assigned_recruiter: ORG_ADMIN_ID,
      next_call_date: callToday ? new Date().toISOString().split('T')[0] : null,
    });
    console.log(`  refreshed ${fn} ${ln}`);
  } else {
    await post('candidates', {
      first_name: fn, last_name: ln, email,
      phone: `9870${String(phoneIdx++).padStart(6, '0')}`,
      designation: desig, current_ctc_lakhs: cur, expected_ctc_lakhs: exp,
      interview_stage: stage, current_status: 'applied',
      source: 'LinkedIn', org_id: ORG_ID,
      assigned_recruiter: ORG_ADMIN_ID, created_by: ORG_ADMIN_ID,
      next_call_date: callToday ? new Date().toISOString().split('T')[0] : null,
      position_applied_for: 'Senior Frontend Developer',
    });
    console.log(`  created ${fn} ${ln}`);
  }
}

// ── 15. Referral code — from org admin's profile ──────────────────────────────
const orgAdminProfile = await get(`profiles?id=eq.${ORG_ADMIN_ID}&select=referral_code`);
const referralCode = orgAdminProfile?.[0]?.referral_code
  || (await get(`profiles?id=eq.${AARAV_ID}&select=referral_code`))?.[0]?.referral_code
  || '41bec8e0';

// ── Write seed-state.json ─────────────────────────────────────────────────────
const state = {
  orgId: ORG_ID, orgAdminId: ORG_ADMIN_ID,
  referralCode, clientId, mandateId, candidateId, formId, formSlug,
  recruiterIds: recruiterIds.map(r => ({ id: r.id, name: r.full_name })),
  seededAt: new Date().toISOString(),
};
writeFileSync(join(here, 'seed-state.json'), JSON.stringify(state, null, 2));
console.log('\nSeed complete. seed-state.json written.');
console.log(`  orgAdmin: siddharth.roy@insync-demo.in (${ORG_ADMIN_ID})`);
console.log(`  referralCode: ${referralCode}  candidate: ${candidateId}  form: ${formSlug}`);
