import { db, collection, setDoc, doc } from './firebase-config.js';

async function setupDoctors() {
    const doctors = [
        { id: "doc1", name: "Sharma", specialty: "Cardiologist", avgConsultationTime: 10, currentToken: 0, lastToken: 0 },
        { id: "doc2", name: "Patel", specialty: "Pediatrician", avgConsultationTime: 8, currentToken: 0, lastToken: 0 },
        { id: "doc3", name: "Khan", specialty: "Orthopedic", avgConsultationTime: 12, currentToken: 0, lastToken: 0 }
    ];

    for (const d of doctors) {
        await setDoc(doc(db, "doctors", d.id), d);
    }
    console.log("Doctors seeded!");
}

// UNCOMMENT THE LINE BELOW TO INITIALIZE DOCTORS ONCE
// setupDoctors();
