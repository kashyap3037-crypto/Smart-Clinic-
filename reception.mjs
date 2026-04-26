import { 
    db, collection, doc, onSnapshot, updateDoc, 
    getDoc, addDoc, query, serverTimestamp, orderBy, deleteDoc 
} from './firebase-config.js';

const regForm = document.getElementById('reg-form');
const bookForm = document.getElementById('book-form');
const patientTable = document.getElementById('patient-table');
const appointmentTable = document.getElementById('appointment-table');

// Shared data
let doctorsMap = {};

// 1. SYNC DOCTOR DROPDOWNS & MAP
onSnapshot(collection(db, "doctors"), (snapshot) => {
    const drSelects = document.querySelectorAll('.r-doctor-select');
    doctorsMap = {}; // Reset map
    
    // Update local map first
    snapshot.forEach(dSnap => {
        doctorsMap[dSnap.id] = dSnap.data();
    });

    // Update selects
    drSelects.forEach(select => {
        const currentVal = select.value;
        select.innerHTML = '<option value="">Choose Doctor</option>';
        Object.entries(doctorsMap).forEach(([id, d]) => {
            select.innerHTML += `<option value="${id}">Dr. ${d.name} (${d.specialty})</option>`;
        });
        select.value = currentVal;
    });

    // Trigger a table refresh if needed by re-running some logic? 
    // Actually, onSnapshot for patients will trigger automatically and use the updated doctorsMap.
});

// 2. REGISTER PATIENT (WALK-IN)
regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerText = "Generating...";

    try {
        const name = document.getElementById('r-name').value;
        const docId = document.getElementById('r-doctor').value;
        const priority = document.getElementById('r-priority').checked;

        const drRef = doc(db, "doctors", docId);
        const drSnap = await getDoc(drRef);
        const nextToken = (drSnap.data().lastToken || 0) + 1;

        await addDoc(collection(db, "patients"), {
            name, docId, token: nextToken, status: 'waiting', priority, createdAt: serverTimestamp()
        });

        await updateDoc(drRef, { lastToken: nextToken });
        alert(`Token Generated: #${nextToken}`);
        regForm.reset();
    } catch (err) {
        alert("Error saving patient.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Generate Token";
    }
});

// 2B. BOOK APPOINTMENT
bookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerText = "Booking...";

    try {
        const name = document.getElementById('rb-name').value;
        const age = document.getElementById('rb-age').value;
        const docId = document.getElementById('rb-doctor').value;
        const date = document.getElementById('rb-date').value;
        const time = document.getElementById('rb-time').value;

        await addDoc(collection(db, "appointments"), {
            name, age, docId, date, time, status: 'scheduled', createdAt: serverTimestamp()
        });

        alert("Appointment Scheduled!");
        bookForm.reset();
    } catch (err) {
        alert("Error booking.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Confirm Booking";
    }
});

// 3. LISTEN FOR PATIENTS (THREE TABLES SYNC)
const completedTable = document.getElementById('completed-table');

onSnapshot(query(collection(db, "patients"), orderBy("createdAt", "desc")), (snapshot) => {
    patientTable.innerHTML = '';
    if(completedTable) completedTable.innerHTML = '';

    snapshot.forEach(pSnap => {
        const id = pSnap.id;
        const p = pSnap.data();
        const dr = doctorsMap[p.docId] || { name: 'Specialist' };
        
        if (p.status === 'serving' || p.status === 'waiting') {
            const isPriority = p.priority;
            patientTable.innerHTML += `
                <tr class="${isPriority ? 'priority-row' : ''}">
                    <td class="row-token" data-label="Token"><span>#${p.token}</span></td>
                    <td data-label="Patient">
                        <div>
                            <div style="font-weight:800; color:var(--text-dark);">${p.name.toUpperCase()}</div>
                            ${isPriority ? '<small style="color:var(--danger); font-weight:800;">🚨 EMERGENCY</small>' : '<small class="text-muted">Walk-in</small>'}
                        </div>
                    </td>
                    <td data-label="Doctor">
                        <span class="badge badge-waiting" style="padding: 6px 14px; border-radius: 10px; font-size: 0.75rem;">
                            DR. ${dr.name.toUpperCase()}
                        </span>
                    </td>
                    <td style="text-align: right;">
                        <button class="btn btn-secondary" style="width: 100%; padding: 12px; font-size: 0.85rem; background: #fff1f2; color: #e11d48; border-radius: 12px; border: none; font-weight: 700;" onclick="removePatient('${id}')">Remove Patient From Queue</button>
                    </td>
                </tr>
            `;
        } else if (p.status === 'served' || p.status === 'skipped') {
            if(completedTable) {
                completedTable.innerHTML += `
                    <tr>
                        <td data-label="Token" style="font-weight: 800; color: #64748b;">#${p.token}</td>
                        <td data-label="Patient"><div>${p.name}</div></td>
                        <td data-label="Doctor"><div>Dr. ${dr.name}</div></td>
                        <td data-label="Status"><span class="badge ${p.status === 'served' ? 'badge-serving' : 'badge-priority'}">${p.status.toUpperCase()}</span></td>
                    </tr>
                `;
            }
        }
    });
});

// 4. LISTEN FOR APPOINTMENTS
onSnapshot(collection(db, "appointments"), (snapshot) => {
    appointmentTable.innerHTML = '';
    snapshot.forEach(aSnap => {
        const id = aSnap.id;
        const a = aSnap.data();
        const dr = doctorsMap[a.docId] || { name: 'Specialist' };
        appointmentTable.innerHTML += `
            <tr>
                <td data-label="Patient">
                    <div>
                        <div style="font-weight: 800;">${a.name}</div>
                        <small class="text-muted">${a.age || '--'} Yrs</small>
                    </div>
                </td>
                <td data-label="Doctor"><div>DR. ${dr.name.toUpperCase()}</div></td>
                <td data-label="Schedule">
                    <div>
                        <div style="font-weight: 700; color: var(--primary); font-size: 0.85rem;">${a.date}</div>
                        <div style="font-size: 0.8rem;">${a.time}</div>
                    </div>
                </td>
                <td style="text-align: right;">
                    <button class="btn btn-secondary" style="width: 100%; border-radius: 10px; font-size: 0.8rem;" onclick="removeAppointment('${id}')">Cancel</button>
                </td>
            </tr>
        `;
    });
});

window.removePatient = (id) => { if(confirm("Remove?")) deleteDoc(doc(db, "patients", id)); };
window.removeAppointment = (id) => { if(confirm("Cancel?")) deleteDoc(doc(db, "appointments", id)); };
