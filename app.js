
const SUPABASE_URL = 'https://bqfphelckjvrwxdvekkl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3IGJe5ZhG4Izw8AsjMICPQ_QTYWsz77';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const DEMO_DAY = '2026-09-24';

let beds = [];
let rooms = [];
let db = { patients: [], stays: [], audit: [] };
let realtimeChannel = null;
let loading = false;
let scanner = null;

const nowISO = () => new Date().toISOString();

function hhmm(iso) {
  if (!iso) return 'hiện tại';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh'
  }).format(new Date(iso));
}

function pt(id) {
  return db.patients.find(p => p.id === id);
}

function activeForBed(id) {
  return db.stays.filter(s => s.bedId === id && !s.end);
}

function stateForBed(id) {
  const n = activeForBed(id).length;
  return n === 0 ? 'available' : n === 1 ? 'single' : n === 2 ? 'shared2' : 'shared3';
}

function stateText(state) {
  return state === 'available' ? 'TRỐNG' :
         state === 'single' ? '1 BN' :
         state === 'shared2' ? 'GHÉP 2' : 'GHÉP ≥3';
}

function bedByCode(code) {
  return beds.find(b => b.id === code);
}

function toast(text) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 14px;border-radius:10px;z-index:99';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function setLive(status) {
  const el = document.querySelector('#liveBadge');
  if (!el) return;
  if (status === 'SUBSCRIBED') {
    el.textContent = '● REALTIME';
    el.style.color = '#16a34a';
  } else if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)) {
    el.textContent = '● MẤT KẾT NỐI';
    el.style.color = '#dc2626';
  } else {
    el.textContent = '● ĐANG KẾT NỐI';
    el.style.color = '#ca8a04';
  }
}

async function loadRemote(showLoading = true) {
  if (loading) return;
  loading = true;
  if (showLoading) setLive('CONNECTING');

  try {
    const [bedRes, patientRes, admRes, stayRes, auditRes] = await Promise.all([
      sb.from('beds').select('id,code,qr_token,max_occupancy,rooms(code,name)').eq('is_active', true).order('code'),
      sb.from('patients').select('id,patient_code,full_name').order('patient_code'),
      sb.from('admissions').select('id,patient_id,admission_code,status'),
      sb.from('bed_stays').select('id,admission_id,bed_id,start_at,end_at,status').eq('status', 'valid').order('start_at'),
      sb.from('audit_logs').select('id,event_type,payload,created_at').order('created_at', { ascending: false }).limit(60)
    ]);

    const errors = [bedRes, patientRes, admRes, stayRes, auditRes]
      .map(x => x.error)
      .filter(Boolean);

    if (errors.length) throw errors[0];

    beds = (bedRes.data || []).map(b => ({
      uuid: b.id,
      id: b.code,
      room: b.rooms?.code || '?',
      roomName: b.rooms?.name || '',
      qr: b.qr_token,
      max: b.max_occupancy
    }));

    rooms = [...new Set(beds.map(b => b.room))];

    const admByPatient = new Map((admRes.data || []).map(a => [a.patient_id, a]));
    const admById = new Map((admRes.data || []).map(a => [a.id, a]));

    db.patients = (patientRes.data || []).map(p => ({
      id: p.id,
      name: p.full_name,
      code: p.patient_code,
      admissionId: admByPatient.get(p.id)?.id || null
    }));

    const bedCodeByUuid = new Map(beds.map(b => [b.uuid, b.id]));

    db.stays = (stayRes.data || []).map(s => {
      const adm = admById.get(s.admission_id);
      return {
        id: s.id,
        admissionId: s.admission_id,
        patientId: adm?.patient_id,
        bedUuid: s.bed_id,
        bedId: bedCodeByUuid.get(s.bed_id) || '?',
        start: s.start_at,
        end: s.end_at
      };
    });

    db.audit = (auditRes.data || []).map(a => ({
      at: a.created_at,
      text: a.event_type,
      payload: a.payload || {}
    }));

    render();
  } catch (e) {
    console.error(e);
    setLive('CHANNEL_ERROR');
    const target = document.querySelector('#rooms');
    if (target) {
      target.innerHTML = '<div class="notice"><b>Không tải được dữ liệu cloud.</b> ' +
        (e.message || e) + '</div>';
    }
  } finally {
    loading = false;
  }
}

function renderStats() {
  const counts = { available: 0, single: 0, shared2: 0, shared3: 0 };
  beds.forEach(b => counts[stateForBed(b.id)]++);
  const census = db.stays.filter(s => !s.end).length;

  document.querySelector('#stats').innerHTML = [
    ['BN hiện tại', census],
    ['Giường trống', counts.available],
    ['1 BN', counts.single],
    ['Ghép 2', counts.shared2],
    ['Ghép ≥3', counts.shared3]
  ].map(([label, value]) =>
    '<div class="stat"><b>' + value + '</b><span>' + label + '</span></div>'
  ).join('');
}

function renderRooms() {
  const q = document.querySelector('#search').value.toLowerCase();
  const filter = document.querySelector('#filter').value;
  let html = '';

  rooms.forEach(roomCode => {
    const roomBeds = beds.filter(b => b.room === roomCode).filter(b => {
      const state = stateForBed(b.id);
      const active = activeForBed(b.id);
      const text = (b.id + ' ' + active.map(s => pt(s.patientId)?.name).join(' ')).toLowerCase();
      return (filter === 'all' || filter === state) && (!q || text.includes(q));
    });

    if (!roomBeds.length) return;

    html += '<div class="room">';
    html += '<div class="room-title"><span>' + roomCode + '</span><span class="muted">' + roomBeds.length + ' giường</span></div>';
    html += '<div class="beds">';

    roomBeds.forEach(b => {
      const state = stateForBed(b.id);
      const active = activeForBed(b.id);
      html += '<button class="bed ' + state + '" onclick="openBed(\'' + b.id + '\')">';
      html += '<div class="code">' + b.id + '</div>';
      html += '<div class="state">' + stateText(state) + '</div>';
      html += '<div class="pts">' +
        (active.length
          ? active.map(s => (pt(s.patientId)?.name || 'BN') + ' · ' + hhmm(s.start)).join('<br>')
          : 'Sẵn sàng tiếp nhận') +
        '</div></button>';
    });

    html += '</div></div>';
  });

  document.querySelector('#rooms').innerHTML = html || '<div class="notice">Không có kết quả phù hợp.</div>';
}

function segmentsForBed(bedId) {
  const dayStart = new Date(DEMO_DAY + 'T00:00:00+07:00');
  const dayEnd = new Date('2026-09-25T00:00:00+07:00');

  const stays = db.stays
    .filter(s => s.bedId === bedId)
    .map(s => ({
      ...s,
      a: new Date(Math.max(new Date(s.start), dayStart)),
      z: new Date(Math.min(s.end ? new Date(s.end) : dayEnd, dayEnd))
    }))
    .filter(s => s.a < s.z);

  const points = [dayStart, dayEnd, ...stays.flatMap(s => [s.a, s.z])]
    .sort((a, b) => a - b)
    .filter((d, i, arr) => i === 0 || +d !== +arr[i - 1]);

  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const z = points[i + 1];
    const active = stays.filter(s => s.a < z && s.z > a);
    if (active.length) {
      out.push({
        a,
        z,
        n: active.length,
        names: active.map(s => pt(s.patientId)?.name || 'BN')
      });
    }
  }
  return out;
}

function renderTimeline() {
  let html = '<div class="trow"><div class="tlabel">Giường</div>' +
    '<div style="padding:8px;font-size:11px;color:#64748b;display:flex;justify-content:space-between">' +
    '<span>00h</span><span>04h</span><span>08h</span><span>12h</span><span>16h</span><span>20h</span><span>24h</span>' +
    '</div></div>';

  beds.forEach(b => {
    const segs = segmentsForBed(b.id);
    html += '<div class="trow"><div class="tlabel">' + b.id + '<div class="muted">' + b.room + '</div></div><div class="track">';

    segs.forEach(s => {
      const start = (s.a - new Date(DEMO_DAY + 'T00:00:00+07:00')) / 86400000 * 100;
      const width = (s.z - s.a) / 86400000 * 100;
      const cls = s.n === 1 ? 'one' : s.n === 2 ? 'two' : 'three';
      html += '<div class="seg ' + cls + '" style="left:' + start + '%;width:' + width + '%" title="' +
        s.names.join(', ') + '">' + hhmm(s.a.toISOString()) + ' · ' + s.n + ' BN</div>';
    });

    html += '</div></div>';
  });

  document.querySelector('#timelineView').innerHTML = html;
}

function auditText(item) {
  const map = {
    'demo.seeded': 'Khởi tạo dữ liệu demo v0.2',
    'bed_stay.started': 'Xếp bệnh nhân vào giường',
    'bed_stay.ended': 'Kết thúc lượt giường',
    'bed_stay.transferred': 'Chuyển giường'
  };
  return map[item.text] || item.text;
}

function renderAudit() {
  document.querySelector('#auditList').innerHTML = db.audit.map(item =>
    '<div class="item"><div><b>' + auditText(item) + '</b><div class="muted">' +
    new Date(item.at).toLocaleString('vi-VN') +
    '</div></div></div>'
  ).join('');
}

function render() {
  renderStats();
  renderRooms();
  renderTimeline();
  renderAudit();
}

window.openBed = function(id) {
  const b = bedByCode(id);
  if (!b) return;

  const active = activeForBed(id);
  const state = stateForBed(id);

  document.querySelector('#bedTitle').textContent = b.room + ' – ' + b.id;
  document.querySelector('#bedSub').textContent = stateText(state) + ' • Supabase realtime';

  let html = '<div class="list">';

  if (active.length) {
    html += active.map(s =>
      '<div class="item"><div><b>' + (pt(s.patientId)?.name || 'BN') + '</b>' +
      '<div class="muted">' + (pt(s.patientId)?.code || '') + ' • từ ' + hhmm(s.start) + '</div></div>' +
      '<div><button class="btn" onclick="transferPrompt(\'' + s.id + '\')">Chuyển</button> ' +
      '<button class="btn danger" onclick="endStay(\'' + s.id + '\')">Kết thúc</button></div></div>'
    ).join('');
  } else {
    html += '<div class="notice">Giường đang trống.</div>';
  }

  html += '</div>';

  html += '<div class="form"><select id="patientSelect">' +
    '<option value="">+ Chọn bệnh nhân để xếp vào ' + id + '</option>' +
    db.patients
      .filter(p => p.admissionId && !db.stays.some(s => s.patientId === p.id && !s.end))
      .map(p => '<option value="' + p.id + '">' + p.name + ' · ' + p.code + '</option>')
      .join('') +
    '</select><button class="btn primary" onclick="assignPatient(\'' + id + '\')">Xếp bệnh nhân</button></div>';

  html += '<div class="notice">QR của giường: <b>' + b.qr +
    '</b>. QR không chứa thông tin bệnh nhân.</div>' +
    '<div id="bedQr" style="display:flex;justify-content:center;padding:10px"></div>';

  document.querySelector('#bedBody').innerHTML = html;
  bedDialog.showModal();

  setTimeout(() => {
    const q = document.querySelector('#bedQr');
    if (q && window.QRCode) {
      new QRCode(q, {
        text: b.qr,
        width: 156,
        height: 156,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }, 50);
};

window.assignPatient = async function(bedCode) {
  const pid = document.querySelector('#patientSelect').value;
  if (!pid) return;

  const p = pt(pid);
  const b = bedByCode(bedCode);
  const n = activeForBed(bedCode).length;

  if (n >= 1 && !confirm('Giường ' + bedCode + ' đang có ' + n + ' BN. Tiếp tục sẽ tạo trạng thái ghép. Xác nhận?')) {
    return;
  }

  const { error } = await sb.rpc('assign_bed', {
    p_admission_id: p.admissionId,
    p_bed_id: b.uuid,
    p_start_at: nowISO()
  });

  if (error) {
    alert('Không thể xếp giường: ' + error.message);
    return;
  }

  toast('Đã xếp giường');
  await loadRemote(false);
  openBed(bedCode);
};

window.endStay = async function(id) {
  if (!confirm('Kết thúc lượt sử dụng giường này?')) return;

  const { error } = await sb.rpc('end_bed_stay', {
    p_stay_id: id,
    p_end_at: nowISO()
  });

  if (error) {
    alert('Không thể kết thúc: ' + error.message);
    return;
  }

  bedDialog.close();
  toast('Đã kết thúc lượt giường');
  await loadRemote(false);
};

window.transferPrompt = async function(id) {
  const s = db.stays.find(x => x.id === id);
  if (!s) return;

  const dest = prompt('Chuyển đến giường nào? Ví dụ G05');
  if (!dest) return;

  const code = dest.toUpperCase();
  const b = bedByCode(code);

  if (!b) {
    alert('Không tìm thấy ' + code);
    return;
  }

  const n = activeForBed(code).length;
  if (n && !confirm(code + ' đang có ' + n + ' BN. Chuyển vào sẽ tạo nằm ghép. Tiếp tục?')) {
    return;
  }

  const { error } = await sb.rpc('transfer_bed', {
    p_stay_id: id,
    p_new_bed_id: b.uuid,
    p_at: nowISO()
  });

  if (error) {
    alert('Không thể chuyển giường: ' + error.message);
    return;
  }

  bedDialog.close();
  toast('Đã chuyển giường');
  await loadRemote(false);
  openBed(code);
};

function setupRealtime() {
  if (realtimeChannel) return;

  realtimeChannel = sb.channel('bvcl-bedflow-demo')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bed_stays' }, () => loadRemote(false))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => loadRemote(false))
    .subscribe(status => setLive(status));
}

document.querySelectorAll('.tab').forEach(button => {
  button.onclick = () => {
    document.querySelectorAll('.tab,.panel').forEach(x => x.classList.remove('active'));
    button.classList.add('active');
    document.querySelector('#' + button.dataset.tab).classList.add('active');
  };
});

document.querySelector('#search').oninput = renderRooms;
document.querySelector('#filter').onchange = renderRooms;
document.querySelector('#resetBtn').onclick = () => loadRemote(true);

document.querySelector('#scanBtn').onclick = async () => {
  scanDialog.showModal();
  try {
    scanner = new Html5Qrcode('reader');
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      text => {
        const match = text.match(/(?:BED:|\/b\/)(G\d{2})/i);
        if (match) {
          closeScanner();
          openBed(match[1].toUpperCase());
        }
      }
    );
  } catch (e) {
    document.querySelector('#reader').innerHTML =
      '<div class="notice">Không mở được camera. Hãy cấp quyền camera hoặc nhập mã giường thủ công.</div>';
  }
};

window.closeScanner = async () => {
  try {
    if (scanner?.isScanning) await scanner.stop();
  } catch (_) {}
  scanner = null;
  scanDialog.close();
};

document.querySelector('#manualOpen').onclick = () => {
  const id = document.querySelector('#manualBed').value.trim().toUpperCase();
  if (bedByCode(id)) {
    closeScanner();
    openBed(id);
  } else {
    alert('Không tìm thấy giường');
  }
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

setupRealtime();
loadRemote(true);
