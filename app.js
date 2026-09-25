
const SUPABASE_URL='https://bqfphelckjvrwxdvekkl.supabase.co';
const SUPABASE_KEY='sb_publishable_3IGJe5ZhG4Izw8AsjMICPQ_QTYWsz77';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

let departments=[],roomRecords=[],beds=[];
let db={patients:[],admissions:[],stays:[],audit:[]};
let selectedDepartmentId=localStorage.getItem('bedflow.selectedDepartmentId')||null;
let realtimeChannel=null,loading=false,scanner=null,currentPage='overview';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const nowISO=()=>new Date().toISOString();

function localParts(d=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
  const x=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return {date:x.year+'-'+x.month+'-'+x.day,time:x.hour+':'+x.minute};
}
function isoAt(dateStr,timeStr){return new Date(dateStr+'T'+timeStr+':00+07:00').toISOString()}
function fmtTime(iso){if(!iso)return 'hiện tại';return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso))}
function fmtDate(iso){if(!iso)return '—';return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso))}
function fmtDateTime(iso){if(!iso)return 'hiện tại';return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso))}
function toast(text){
  const el=document.createElement('div');el.textContent=text;
  el.style='position:fixed;left:50%;bottom:78px;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 14px;border-radius:11px;z-index:100;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.2)';
  document.body.appendChild(el);setTimeout(()=>el.remove(),1900);
}
function setLive(status){
  const el=$('#liveBadge');if(!el)return;
  if(status==='SUBSCRIBED'){el.textContent='● REALTIME';el.style.color='#16a34a'}
  else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){el.textContent='● MẤT KẾT NỐI';el.style.color='#dc2626'}
  else{el.textContent='● ĐANG KẾT NỐI';el.style.color='#d97706'}
}
function currentDepartment(){return departments.find(d=>d.uuid===selectedDepartmentId)||departments[0]||null}
function roomById(id){return roomRecords.find(r=>r.uuid===id)}
function bedById(id){return beds.find(b=>b.uuid===id)}
function bedByCode(code){return beds.find(b=>b.code.toUpperCase()===String(code||'').trim().toUpperCase())}
function bedByQR(value){
  const raw=String(value||'').trim();
  return beds.find(b=>String(b.qr).toUpperCase()===raw.toUpperCase()) || (/^BED:/i.test(raw)?bedByCode(raw.slice(4)):null);
}
function admissionById(id){return db.admissions.find(a=>a.id===id)}
function patientById(id){return db.patients.find(p=>p.id===id)}
function patientForAdmission(admId){const a=admissionById(admId);return a?patientById(a.patientId):null}
function activeStayForAdmission(admId){return db.stays.find(s=>s.admissionId===admId&&!s.end)}
function activeForBed(bedId){return db.stays.filter(s=>s.bedId===bedId&&!s.end)}
function stateForBed(b){
  if(!b.active)return 'off';
  const n=activeForBed(b.uuid).length;
  return n===0?'available':n===1?'single':n===2?'shared2':'shared3';
}
function stateText(st){
  return st==='available'?'TRỐNG':st==='single'?'1 BN':st==='shared2'?'GHÉP 2':st==='shared3'?'GHÉP ≥3':'NGƯNG';
}
function departmentBeds(){return beds.filter(b=>b.departmentId===selectedDepartmentId)}
function departmentRooms(){return roomRecords.filter(r=>r.departmentId===selectedDepartmentId)}

async function loadRemote(showLoading=true){
  if(loading)return;loading=true;if(showLoading)setLive('CONNECTING');
  try{
    const [d,r,b,p,a,s,log]=await Promise.all([
      sb.from('departments').select('id,code,name').order('code'),
      sb.from('rooms').select('id,department_id,code,name').order('code'),
      sb.from('beds').select('id,room_id,code,qr_token,max_occupancy,is_active,rooms(department_id,code,name)').order('code'),
      sb.from('patients').select('id,patient_code,full_name,created_at').order('created_at',{ascending:false}),
      sb.from('admissions').select('id,admission_code,patient_id,department_id,admitted_at,discharged_at,status,created_at').order('admitted_at',{ascending:false}),
      sb.from('bed_stays').select('id,admission_id,bed_id,start_at,end_at,status,note').eq('status','valid').order('start_at',{ascending:false}),
      sb.from('audit_logs').select('id,event_type,admission_id,bed_id,payload,created_at').order('created_at',{ascending:false}).limit(100)
    ]);
    const err=[d,r,b,p,a,s,log].find(x=>x.error)?.error;if(err)throw err;
    departments=(d.data||[]).map(x=>({uuid:x.id,code:x.code,name:x.name}));
    if(!selectedDepartmentId||!departments.some(x=>x.uuid===selectedDepartmentId)){
      selectedDepartmentId=departments[0]?.uuid||null;
      if(selectedDepartmentId)localStorage.setItem('bedflow.selectedDepartmentId',selectedDepartmentId);
    }
    roomRecords=(r.data||[]).map(x=>({uuid:x.id,departmentId:x.department_id,code:x.code,name:x.name}));
    beds=(b.data||[]).map(x=>({
      uuid:x.id,roomUuid:x.room_id,departmentId:x.rooms?.department_id||roomById(x.room_id)?.departmentId,
      code:x.code,roomCode:x.rooms?.code||'?',roomName:x.rooms?.name||'',qr:x.qr_token,max:x.max_occupancy,active:x.is_active
    }));
    db.patients=(p.data||[]).map(x=>({id:x.id,code:x.patient_code,name:x.full_name,createdAt:x.created_at}));
    db.admissions=(a.data||[]).map(x=>({id:x.id,code:x.admission_code,patientId:x.patient_id,departmentId:x.department_id,admittedAt:x.admitted_at,dischargedAt:x.discharged_at,status:x.status}));
    db.stays=(s.data||[]).map(x=>({id:x.id,admissionId:x.admission_id,bedId:x.bed_id,start:x.start_at,end:x.end_at,note:x.note||''}));
    db.audit=(log.data||[]).map(x=>({id:x.id,type:x.event_type,admissionId:x.admission_id,bedId:x.bed_id,payload:x.payload||{},at:x.created_at}));
    renderAll();
    if(realtimeChannel)setLive('SUBSCRIBED');
  }catch(e){
    console.error(e);setLive('CHANNEL_ERROR');toast('Không tải được dữ liệu: '+(e.message||e));
  }finally{loading=false}
}

function renderDepartmentSelector(){
  const sel=$('#departmentSelect');if(!sel)return;
  sel.innerHTML=departments.map(d=>'<option value="'+d.uuid+'">'+esc(d.code)+' · '+esc(d.name)+'</option>').join('');
  if(selectedDepartmentId)sel.value=selectedDepartmentId;
}
function renderStats(){
  const deptBeds=departmentBeds().filter(b=>b.active);
  const counts={available:0,single:0,shared2:0,shared3:0};
  deptBeds.forEach(b=>counts[stateForBed(b)]++);
  const bedSet=new Set(deptBeds.map(b=>b.uuid));
  const census=db.stays.filter(s=>!s.end&&bedSet.has(s.bedId)).length;
  $('#stats').innerHTML=[
    ['BN hiện tại',census],['Giường hoạt động',deptBeds.length],['Giường trống',counts.available],['Ghép 2',counts.shared2],['Ghép ≥3',counts.shared3]
  ].map(x=>'<div class="stat"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('');
}
function renderOverview(){
  renderStats();
  const q=($('#overviewSearch')?.value||'').trim().toLowerCase();
  const filter=$('#overviewFilter')?.value||'all';
  let html='';
  departmentRooms().forEach(room=>{
    const rb=beds.filter(b=>b.roomUuid===room.uuid&&b.active).filter(b=>{
      const st=stateForBed(b),acts=activeForBed(b.uuid);
      const names=acts.map(s=>patientForAdmission(s.admissionId)?.name||'').join(' ');
      return (filter==='all'||filter===st)&&(!q||(b.code+' '+names).toLowerCase().includes(q));
    });
    if(!rb.length)return;
    html+='<section class="room-section"><div class="room-head"><div><b>'+esc(room.code)+' · '+esc(room.name)+'</b></div><span class="muted">'+rb.length+' giường</span></div><div class="bed-grid">';
    rb.forEach(b=>{
      const st=stateForBed(b),acts=activeForBed(b.uuid);
      html+='<article class="bed-card '+st+'"><div class="bed-top"><button class="bed-code" onclick="openBed(\''+b.uuid+'\',\'view\')">'+esc(b.code)+'</button><span class="badge '+st+'">'+stateText(st)+'</span></div>';
      html+='<div class="patients-mini">';
      if(!acts.length)html+='<div class="muted" style="font-size:12px">Sẵn sàng tiếp nhận</div>';
      acts.forEach(s=>{
        const p=patientForAdmission(s.admissionId);
        html+='<div class="patient-mini"><div style="min-width:0"><b>'+esc(p?.name||'BN')+'</b><small> · '+fmtTime(s.start)+'</small></div><div class="mini-actions"><button class="icon-btn" onclick="openBed(\''+b.uuid+'\',\'transfer\',\''+s.id+'\')">Chuyển</button><button class="icon-btn" onclick="openBed(\''+b.uuid+'\',\'end\',\''+s.id+'\')">Rời</button></div></div>';
      });
      html+='</div><div class="bed-actions"><button class="btn primary sm" onclick="openBed(\''+b.uuid+'\',\'add\')">+ BN</button><button class="btn sm" onclick="openBed(\''+b.uuid+'\',\'qr\')">QR</button></div></article>';
    });
    html+='</div></section>';
  });
  $('#overviewRooms').innerHTML=html||'<div class="card empty">Không có giường phù hợp.</div>';
}

function renderPatients(){
  const q=($('#patientSearch')?.value||'').trim().toLowerCase();
  const filter=$('#patientFilter')?.value||'all';
  const rows=db.admissions
    .filter(a=>a.departmentId===selectedDepartmentId)
    .filter(a=>{
      const p=patientById(a.patientId),st=activeStayForAdmission(a.id);
      const okFilter=filter==='all'||(filter==='inbed'&&st)||(filter==='nobed'&&!st);
      const txt=((p?.name||'')+' '+(p?.code||'')+' '+a.code).toLowerCase();
      return okFilter&&(!q||txt.includes(q));
    })
    .map(a=>{
      const p=patientById(a.patientId),st=activeStayForAdmission(a.id),b=st?bedById(st.bedId):null;
      return '<div class="list-row"><div><b>'+esc(p?.name||'BN')+'</b><div class="sub">'+esc(p?.code||'')+' · '+esc(a.code)+'</div></div>'+
        '<div class="hide-mobile"><b>'+ (b?esc(b.roomCode+' – '+b.code):'Không nằm giường') +'</b><div class="sub">'+(st?'Từ '+fmtDateTime(st.start):'Có lịch sử để tra cứu')+'</div></div>'+
        '<div class="hide-mobile"><span class="sub">Nhập '+fmtDateTime(a.admittedAt)+'</span></div>'+
        '<button class="btn sm" onclick="openPatient(\''+a.id+'\')">Chi tiết</button></div>';
    }).join('');
  $('#patientList').innerHTML=rows||'<div class="empty">Không có bệnh nhân phù hợp.</div>';
}

function rangeBounds(){
  const lp=localParts();
  const from=$('#timelineFrom')?.value||lp.date,to=$('#timelineTo')?.value||lp.date;
  return {from,to,start:new Date(from+'T00:00:00+07:00'),end:new Date(to+'T23:59:59+07:00')};
}
function overlapStay(s,start,end){
  const a=new Date(s.start),z=s.end?new Date(s.end):new Date();
  return a<=end&&z>=start;
}
function occupancySegments(bedId,start,end){
  const stays=db.stays.filter(s=>s.bedId===bedId&&overlapStay(s,start,end)).map(s=>({
    ...s,a:new Date(Math.max(new Date(s.start),start)),z:new Date(Math.min(s.end?new Date(s.end):new Date(),end))
  })).filter(s=>s.a<s.z);
  const points=[start,end,...stays.flatMap(s=>[s.a,s.z])].sort((a,b)=>a-b).filter((d,i,a)=>i===0||+d!==+a[i-1]);
  const out=[];
  for(let i=0;i<points.length-1;i++){
    const a=points[i],z=points[i+1],active=stays.filter(s=>s.a<z&&s.z>a);
    if(active.length)out.push({a,z,n:active.length,stays:active});
  }
  return out;
}
function renderTimelineFilters(){
  const room=$('#timelineRoom');if(!room)return;
  const current=room.value;
  room.innerHTML='<option value="">Tất cả phòng</option>'+departmentRooms().map(r=>'<option value="'+r.uuid+'">'+esc(r.code)+' · '+esc(r.name)+'</option>').join('');
  if(departmentRooms().some(r=>r.uuid===current))room.value=current;
}
function renderTimeline(){
  renderTimelineFilters();
  const {start,end}=rangeBounds();
  const roomId=$('#timelineRoom')?.value||'';
  const q=($('#timelineSearch')?.value||'').trim().toLowerCase();
  let html='';
  departmentBeds().filter(b=>!roomId||b.roomUuid===roomId).forEach(b=>{
    const stays=db.stays.filter(s=>s.bedId===b.uuid&&overlapStay(s,start,end));
    const names=stays.map(s=>patientForAdmission(s.admissionId)?.name||'').join(' ');
    if(q&&!(b.code+' '+names).toLowerCase().includes(q))return;
    if(!stays.length)return;
    const segs=occupancySegments(b.uuid,start,end);
    html+='<div class="timeline-bed"><div class="timeline-title"><div><b style="font-size:16px">'+esc(b.code)+'</b> <span class="muted">'+esc(b.roomCode+' · '+b.roomName)+'</span></div><button class="btn sm" onclick="openBed(\''+b.uuid+'\',\'view\')">Mở giường</button></div>';
    segs.forEach(seg=>{
      const names2=seg.stays.map(s=>patientForAdmission(s.admissionId)?.name||'BN').join(' + ');
      const cls=seg.n===1?'single':seg.n===2?'shared2':'shared3';
      html+='<div class="stay-row"><div><span class="badge '+cls+'">'+(seg.n===1?'1 BN':'GHÉP '+seg.n)+'</span></div><div><b>'+esc(names2)+'</b></div><div>'+fmtDateTime(seg.a.toISOString())+' → '+fmtDateTime(seg.z.toISOString())+'</div></div>';
    });
    html+='</div>';
  });
  $('#timelineList').innerHTML=html||'<div class="empty">Không có lượt giường trong khoảng thời gian này.</div>';
}

function auditLabel(type){
  const m={
    'bed_stay.started':'Xếp BN vào giường','bed_stay.ended':'BN rời giường','bed_stay.transferred':'Chuyển giường/phòng',
    'patient.quick_admitted':'Nhập BN nhanh','catalog.department.created':'Tạo khoa','catalog.department.updated':'Sửa khoa',
    'catalog.room.created':'Tạo phòng','catalog.room.updated':'Sửa phòng','catalog.bed.created':'Tạo giường','catalog.bed.updated':'Sửa giường',
    'catalog.bed.deleted':'Xóa giường','catalog.bed.retired':'Ngưng giường'
  };return m[type]||type;
}
function renderAdmin(){
  const deptOptions=departments.map(d=>'<option value="'+d.uuid+'">'+esc(d.code)+' · '+esc(d.name)+'</option>').join('');
  const roomOptions=roomRecords.map(r=>'<option value="'+r.uuid+'">'+esc(departments.find(d=>d.uuid===r.departmentId)?.code||'')+' / '+esc(r.code)+'</option>').join('');
  const depRows=departments.map(d=>'<tr><td><b>'+esc(d.code)+'</b></td><td>'+esc(d.name)+'</td><td><button class="btn sm" onclick="editDepartment(\''+d.uuid+'\')">Sửa</button></td></tr>').join('');
  const roomRows=roomRecords.map(r=>'<tr><td>'+esc(departments.find(d=>d.uuid===r.departmentId)?.code||'')+'</td><td><b>'+esc(r.code)+'</b></td><td>'+esc(r.name)+'</td><td><button class="btn sm" onclick="editRoom(\''+r.uuid+'\')">Sửa</button></td></tr>').join('');
  const bedRows=beds.map(b=>'<tr><td>'+esc(b.roomCode)+'</td><td><b>'+esc(b.code)+'</b></td><td>'+b.max+'</td><td>'+(b.active?'Hoạt động':'Ngưng')+'</td><td style="white-space:nowrap"><button class="btn sm" onclick="editBed(\''+b.uuid+'\')">Sửa</button> <button class="btn sm" onclick="openBed(\''+b.uuid+'\',\'qr\')">QR</button> '+(b.active?'<button class="btn danger sm" onclick="deleteBed(\''+b.uuid+'\')">Xóa</button>':'<button class="btn sm" onclick="activateBed(\''+b.uuid+'\')">Kích hoạt</button>')+'</td></tr>').join('');
  $('#adminCatalog').innerHTML=
    '<div class="card admin-card"><h3>Khoa</h3><div class="form-row"><div class="field"><label>Mã khoa</label><input id="newDeptCode" placeholder="NTH"/></div><div class="field"><label>Tên khoa</label><input id="newDeptName" placeholder="Nội tổng hợp"/></div></div><button class="btn primary" onclick="createDepartment()">+ Tạo khoa</button><div class="table-wrap" style="margin-top:10px"><table class="table"><thead><tr><th>Mã</th><th>Tên</th><th></th></tr></thead><tbody>'+depRows+'</tbody></table></div></div>'+
    '<div class="card admin-card"><h3>Phòng</h3><div class="field"><label>Khoa</label><select id="newRoomDept">'+deptOptions+'</select></div><div class="form-row" style="margin-top:8px"><div class="field"><label>Mã phòng</label><input id="newRoomCode" placeholder="P301"/></div><div class="field"><label>Tên phòng</label><input id="newRoomName" placeholder="Phòng 301"/></div></div><button class="btn primary" onclick="createRoom()">+ Tạo phòng</button><div class="table-wrap" style="margin-top:10px"><table class="table"><thead><tr><th>Khoa</th><th>Mã</th><th>Tên</th><th></th></tr></thead><tbody>'+roomRows+'</tbody></table></div></div>'+
    '<div class="card admin-card"><h3>Giường</h3><div class="field"><label>Phòng</label><select id="newBedRoom">'+roomOptions+'</select></div><div class="form-row" style="margin-top:8px"><div class="field"><label>Mã giường</label><input id="newBedCode" placeholder="G01"/></div><div class="field"><label>BN tối đa</label><input id="newBedMax" type="number" min="1" max="6" value="3"/></div></div><button class="btn primary" onclick="createBed()">+ Tạo giường + QR</button><div class="table-wrap" style="margin-top:10px"><table class="table"><thead><tr><th>Phòng</th><th>Giường</th><th>Max</th><th>TT</th><th></th></tr></thead><tbody>'+bedRows+'</tbody></table></div></div>';
  $('#auditList').innerHTML=db.audit.map(x=>'<div class="list-row"><div><b>'+esc(auditLabel(x.type))+'</b><div class="sub">'+fmtDateTime(x.at)+'</div></div><div class="hide-mobile sub">'+esc(JSON.stringify(x.payload).slice(0,160))+'</div><div></div><span></span></div>').join('')||'<div class="empty">Chưa có nhật ký.</div>';
}
function renderAll(){renderDepartmentSelector();renderOverview();renderPatients();renderTimeline();renderAdmin()}

function setPage(page){
  currentPage=page;
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+page));
  document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===page));
  if(page==='beds')renderTimeline();if(page==='patients')renderPatients();if(page==='admin')renderAdmin();
}
window.openBed=function(bedId,mode='view',stayId=null){
  const b=bedById(bedId);if(!b)return;
  const acts=activeForBed(b.uuid),st=stateForBed(b);
  $('#bedTitle').textContent=b.roomCode+' – '+b.code;
  $('#bedSub').textContent=stateText(st)+' · '+b.roomName;
  let html='<div class="notice"><b>Đang nằm: '+acts.length+' BN.</b> Ghép/hết ghép được hệ thống tự suy ra theo các khoảng thời gian, không nhập tỷ lệ thủ công.</div>';
  if(acts.length){
    acts.forEach(s=>{
      const p=patientForAdmission(s.admissionId);
      html+='<div class="current-patient"><div><b>'+esc(p?.name||'BN')+'</b><div class="sub">Từ '+fmtDateTime(s.start)+'</div></div><div class="actions"><button class="btn sm" onclick="openBed(\''+b.uuid+'\',\'transfer\',\''+s.id+'\')">Chuyển</button><button class="btn danger sm" onclick="openBed(\''+b.uuid+'\',\'end\',\''+s.id+'\')">Rời giường</button></div></div>';
    });
  }else html+='<div class="empty" style="padding:14px">Giường đang trống.</div>';
  html+='<div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary" onclick="openBed(\''+b.uuid+'\',\'add\')">+ Nhập BN</button><button class="btn" onclick="openBed(\''+b.uuid+'\',\'qr\')">QR giường</button></div>';
  if(mode==='add')html+=addForm(b);
  if(mode==='transfer')html+=transferForm(b,stayId);
  if(mode==='end')html+=endForm(b,stayId);
  if(mode==='qr')html+=qrForm(b);
  $('#bedBody').innerHTML=html;
  $('#bedDialog').showModal();
  if(mode==='qr')setTimeout(()=>renderQr('#bedQr',b.qr,220),40);
  if(mode==='transfer')setTimeout(()=>refreshTransferBeds(b,stayId),20);
};
function addForm(b){
  const n=activeForBed(b.uuid).length,tm=localParts();
  return '<div class="action-panel"><h4>+ Nhập bệnh nhân vào '+esc(b.code)+'</h4>'+
    (n?'<div class="notice">Giường hiện có '+n+' BN. Thêm BN sẽ thành <b>ghép '+(n+1)+'</b>.</div>':'')+
    '<div class="field"><label>Tên bệnh nhân</label><input id="quickName" autocomplete="off" placeholder="Nhập họ tên BN"/></div>'+
    '<div class="field" style="margin-top:8px"><label>Giờ bắt đầu hôm nay ('+tm.date.split('-').reverse().join('/')+')</label><input id="quickTime" type="time" value="'+tm.time+'"/></div>'+
    '<button class="btn primary" style="width:100%;margin-top:10px" onclick="submitQuickAdmit(\''+b.uuid+'\')">Xác nhận nhập BN</button></div>';
}
window.submitQuickAdmit=async function(bedId){
  const name=$('#quickName')?.value.trim(),time=$('#quickTime')?.value,day=localParts().date;
  if(!name||!time){alert('Nhập tên bệnh nhân và giờ/phút.');return}
  const b=bedById(bedId),n=activeForBed(bedId).length;
  if(n&&!confirm('Giường '+b.code+' đang có '+n+' BN. Thêm BN này sẽ tạo trạng thái ghép. Tiếp tục?'))return;
  const {error}=await sb.rpc('quick_admit_to_bed',{p_full_name:name,p_bed_id:bedId,p_start_at:isoAt(day,time)});
  if(error){alert('Không thể nhập BN: '+error.message);return}
  toast('Đã nhập '+name+' vào '+b.code);await loadRemote(false);openBed(bedId,'view');
};
function transferForm(b,stayId){
  const s=db.stays.find(x=>x.id===stayId);if(!s)return '';
  const p=patientForAdmission(s.admissionId),tm=localParts();
  const rooms=departmentRooms().map(r=>'<option value="'+r.uuid+'"'+(r.uuid===b.roomUuid?' selected':'')+'>'+esc(r.code)+' · '+esc(r.name)+'</option>').join('');
  return '<div class="action-panel"><h4>Chuyển '+esc(p?.name||'BN')+'</h4><div class="sub" style="margin-bottom:8px">Từ '+esc(b.roomCode+' – '+b.code)+'</div>'+
    '<div class="form-row"><div class="field"><label>Phòng đến</label><select id="transferRoom" onchange="refreshTransferBedsById(\''+b.uuid+'\',\''+stayId+'\')">'+rooms+'</select></div><div class="field"><label>Giường đến</label><select id="transferBed"></select></div></div>'+
    '<div class="field"><label>Thời điểm chuyển hôm nay</label><input id="transferTime" type="time" value="'+tm.time+'"/></div>'+
    '<button class="btn blue" style="width:100%;margin-top:10px" onclick="submitTransfer(\''+stayId+'\')">Xác nhận chuyển giường / phòng</button></div>';
}
window.refreshTransferBedsById=function(fromBedId,stayId){refreshTransferBeds(bedById(fromBedId),stayId)}
function refreshTransferBeds(fromBed,stayId){
  const sel=$('#transferRoom'),dst=$('#transferBed');if(!sel||!dst)return;
  const roomId=sel.value||departmentRooms()[0]?.uuid;if(roomId)sel.value=roomId;
  const options=beds.filter(x=>x.active&&x.roomUuid===roomId&&x.uuid!==fromBed.uuid).map(x=>{
    const n=activeForBed(x.uuid).length;return '<option value="'+x.uuid+'">'+esc(x.code)+' · '+(n?n+' BN':'TRỐNG')+'</option>';
  }).join('');
  dst.innerHTML=options||'<option value="">Không có giường phù hợp</option>';
}
window.submitTransfer=async function(stayId){
  const dst=$('#transferBed')?.value,time=$('#transferTime')?.value,day=localParts().date;
  if(!dst||!time){alert('Chọn giường đến và thời điểm chuyển.');return}
  const b=bedById(dst),n=activeForBed(dst).length;
  if(n&&!confirm(b.code+' đang có '+n+' BN. Chuyển vào sẽ tạo trạng thái ghép. Tiếp tục?'))return;
  const {error}=await sb.rpc('transfer_bed',{p_stay_id:stayId,p_new_bed_id:dst,p_at:isoAt(day,time)});
  if(error){alert('Không thể chuyển: '+error.message);return}
  toast('Đã chuyển giường');await loadRemote(false);openBed(dst,'view');
};
function endForm(b,stayId){
  const s=db.stays.find(x=>x.id===stayId);if(!s)return '';
  const p=patientForAdmission(s.admissionId),tm=localParts();
  return '<div class="action-panel"><h4>Rời '+esc(b.code)+'</h4><div class="notice"><b>'+esc(p?.name||'BN')+'</b> sẽ kết thúc sử dụng giường này. Lịch sử không bị xóa.</div>'+
    '<div class="field"><label>Thời điểm rời giường hôm nay</label><input id="endTime" type="time" value="'+tm.time+'"/></div>'+
    '<button class="btn danger" style="width:100%;margin-top:10px" onclick="submitEnd(\''+stayId+'\',\''+b.uuid+'\')">Xác nhận rời giường</button></div>';
}
window.submitEnd=async function(stayId,bedId){
  const time=$('#endTime')?.value,day=localParts().date;if(!time)return;
  if(!confirm('Xác nhận kết thúc lượt sử dụng giường tại '+time+'?'))return;
  const {error}=await sb.rpc('end_bed_stay',{p_stay_id:stayId,p_end_at:isoAt(day,time)});
  if(error){alert('Không thể kết thúc: '+error.message);return}
  toast('Đã ghi nhận rời giường');await loadRemote(false);openBed(bedId,'view');
};
function qrForm(b){
  const d=departments.find(x=>x.uuid===b.departmentId);
  return '<div class="action-panel" style="text-align:center"><h4>QR định danh giường</h4><div style="font-size:22px;font-weight:950">'+esc(b.code)+'</div><div class="sub">'+esc(d?.name||'')+' · '+esc(b.roomCode)+'</div><div id="bedQr" class="qrbox"></div><div class="sub">QR gắn với UUID vật lý; đổi mã giường không làm đổi QR.</div><button class="btn primary" style="margin-top:10px" onclick="downloadBedQR(\''+b.uuid+'\')">Tải QR PNG</button></div>';
}
function renderQr(selector,text,size){
  const q=document.querySelector(selector);if(!q||!window.QRCode)return;q.innerHTML='';
  new QRCode(q,{text:text,width:size,height:size,colorDark:'#0f172a',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
}
window.downloadBedQR=function(id){
  const b=bedById(id);if(!b)return;const h=document.createElement('div');h.style='position:fixed;left:-9999px';document.body.appendChild(h);
  new QRCode(h,{text:b.qr,width:512,height:512,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M});
  setTimeout(()=>{const c=h.querySelector('canvas'),im=h.querySelector('img'),url=c?c.toDataURL('image/png'):im?.src;if(url){const a=document.createElement('a');a.href=url;a.download='QR_'+b.code+'.png';a.click()}h.remove()},100);
};

window.openPatient=function(admissionId){
  const a=admissionById(admissionId);if(!a)return;const p=patientById(a.patientId),active=activeStayForAdmission(a.id);
  $('#bedTitle').textContent=p?.name||'Bệnh nhân';$('#bedSub').textContent=(p?.code||'')+' · '+a.code;
  const stays=db.stays.filter(s=>s.admissionId===a.id).sort((x,y)=>new Date(x.start)-new Date(y.start));
  let html='<div class="notice"><b>Đợt điều trị:</b> '+fmtDateTime(a.admittedAt)+(a.dischargedAt?' → '+fmtDateTime(a.dischargedAt):' → hiện tại')+'</div>';
  if(active){const b=bedById(active.bedId);html+='<div class="current-patient"><div><b>Hiện tại: '+esc(b?.roomCode+' – '+b?.code)+'</b><div class="sub">Từ '+fmtDateTime(active.start)+'</div></div><div class="actions"><button class="btn sm" onclick="openBed(\''+b.uuid+'\',\'transfer\',\''+active.id+'\')">Chuyển</button><button class="btn danger sm" onclick="openBed(\''+b.uuid+'\',\'end\',\''+active.id+'\')">Rời giường</button></div></div>'}
  html+='<h4>Lịch sử giường</h4>';
  stays.forEach(s=>{const b=bedById(s.bedId);html+='<div class="history-line"><b>'+esc((b?.roomCode||'?')+' – '+(b?.code||'?'))+'</b><div class="sub">'+fmtDateTime(s.start)+' → '+(s.end?fmtDateTime(s.end):'hiện tại')+'</div></div>'});
  if(!stays.length)html+='<div class="empty">Chưa có lịch sử giường.</div>';
  $('#bedBody').innerHTML=html;$('#bedDialog').showModal();
};

window.createDepartment=async function(){
  const code=$('#newDeptCode')?.value.trim(),name=$('#newDeptName')?.value.trim();if(!code||!name){alert('Nhập đủ mã và tên khoa.');return}
  const {data,error}=await sb.rpc('create_department',{p_code:code,p_name:name});if(error){alert(error.message);return}
  selectedDepartmentId=data;localStorage.setItem('bedflow.selectedDepartmentId',data);toast('Đã tạo khoa');await loadRemote(false);
};
window.editDepartment=async function(id){
  const d=departments.find(x=>x.uuid===id);if(!d)return;const code=prompt('Mã khoa',d.code);if(code===null)return;const name=prompt('Tên khoa',d.name);if(name===null)return;
  const {error}=await sb.rpc('update_department',{p_department_id:id,p_code:code,p_name:name});if(error){alert(error.message);return}toast('Đã sửa khoa');await loadRemote(false);
};
window.createRoom=async function(){
  const dep=$('#newRoomDept')?.value,code=$('#newRoomCode')?.value.trim(),name=$('#newRoomName')?.value.trim();if(!dep||!code||!name){alert('Nhập đủ thông tin phòng.');return}
  const {error}=await sb.rpc('create_room',{p_department_id:dep,p_code:code,p_name:name});if(error){alert(error.message);return}toast('Đã tạo phòng');await loadRemote(false);
};
window.editRoom=async function(id){
  const r=roomById(id);if(!r)return;const code=prompt('Mã phòng',r.code);if(code===null)return;const name=prompt('Tên phòng',r.name);if(name===null)return;
  const {error}=await sb.rpc('update_room',{p_room_id:id,p_code:code,p_name:name});if(error){alert(error.message);return}toast('Đã sửa phòng');await loadRemote(false);
};
window.createBed=async function(){
  const room=$('#newBedRoom')?.value,code=$('#newBedCode')?.value.trim(),max=Number($('#newBedMax')?.value||3);if(!room||!code){alert('Chọn phòng và nhập mã giường.');return}
  const {error}=await sb.rpc('create_bed',{p_room_id:room,p_code:code,p_max_occupancy:max});if(error){alert(error.message);return}toast('Đã tạo giường và QR');await loadRemote(false);
};
window.editBed=async function(id){
  const b=bedById(id);if(!b)return;const code=prompt('Mã giường',b.code);if(code===null)return;const max=Number(prompt('Số BN tối đa',String(b.max)));if(!max)return;
  const {error}=await sb.rpc('update_bed',{p_bed_id:id,p_room_id:b.roomUuid,p_code:code,p_max_occupancy:max,p_is_active:b.active});if(error){alert(error.message);return}toast('Đã sửa giường');await loadRemote(false);
};
window.deleteBed=async function(id){
  const b=bedById(id);if(!b||!confirm('Xóa giường '+b.code+'? Nếu đã có lịch sử, hệ thống chỉ chuyển sang Ngưng sử dụng.'))return;
  const {data,error}=await sb.rpc('delete_bed',{p_bed_id:id});if(error){alert(error.message);return}toast(data==='deleted'?'Đã xóa giường':'Đã ngưng giường, lịch sử được giữ');await loadRemote(false);
};
window.activateBed=async function(id){
  const b=bedById(id);if(!b)return;const {error}=await sb.rpc('update_bed',{p_bed_id:id,p_room_id:b.roomUuid,p_code:b.code,p_max_occupancy:b.max,p_is_active:true});if(error){alert(error.message);return}toast('Đã kích hoạt giường');await loadRemote(false);
};

async function startScanner(){
  $('#scanDialog').showModal();
  if(!window.Html5Qrcode){toast('Không tải được trình quét QR');return}
  try{
    scanner=new Html5Qrcode('reader');
    await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:240,height:240}},text=>{
      const b=bedByQR(text);if(b){closeScanner();openBed(b.uuid,'add')}
    },()=>{});
  }catch(e){console.warn(e);toast('Không mở được camera. Có thể nhập mã giường thủ công.')}
}
window.closeScanner=async function(){
  try{if(scanner){await scanner.stop();await scanner.clear();scanner=null}}catch(e){}
  if($('#scanDialog').open)$('#scanDialog').close();
}
function setupRealtime(){
  if(realtimeChannel)return;
  realtimeChannel=sb.channel('bedflow-v05')
    .on('postgres_changes',{event:'*',schema:'public',table:'departments'},()=>loadRemote(false))
    .on('postgres_changes',{event:'*',schema:'public',table:'rooms'},()=>loadRemote(false))
    .on('postgres_changes',{event:'*',schema:'public',table:'beds'},()=>loadRemote(false))
    .on('postgres_changes',{event:'*',schema:'public',table:'patients'},()=>loadRemote(false))
    .on('postgres_changes',{event:'*',schema:'public',table:'admissions'},()=>loadRemote(false))
    .on('postgres_changes',{event:'*',schema:'public',table:'bed_stays'},()=>loadRemote(false))
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'audit_logs'},()=>loadRemote(false))
    .subscribe(status=>setLive(status));
}

document.addEventListener('DOMContentLoaded',()=>{
  const lp=localParts();const seven=new Date(Date.now()-6*86400000);
  $('#timelineFrom').value=localParts(seven).date;$('#timelineTo').value=lp.date;
  document.querySelectorAll('[data-page]').forEach(x=>x.addEventListener('click',()=>setPage(x.dataset.page)));
  $('#departmentSelect').addEventListener('change',e=>{selectedDepartmentId=e.target.value;localStorage.setItem('bedflow.selectedDepartmentId',selectedDepartmentId);renderAll()});
  $('#overviewSearch').addEventListener('input',renderOverview);$('#overviewFilter').addEventListener('change',renderOverview);
  $('#patientSearch').addEventListener('input',renderPatients);$('#patientFilter').addEventListener('change',renderPatients);
  $('#timelineApply').addEventListener('click',renderTimeline);$('#timelineRoom').addEventListener('change',renderTimeline);
  $('#reloadBtn').addEventListener('click',()=>loadRemote(true));
  $('#scanBtn').addEventListener('click',startScanner);$('#scanBtnSide').addEventListener('click',startScanner);
  $('#manualOpen').addEventListener('click',()=>{const b=bedByCode($('#manualBed').value);if(!b){alert('Không tìm thấy giường.');return}closeScanner();openBed(b.uuid,'add')});
  setupRealtime();loadRemote(true);
});
