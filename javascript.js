// --- 1. CONFIGURATION & MODALES ---
const consentModal = document.getElementById('consent-modal');
const cguModal = document.getElementById('cgu-modal');

// Ne pas afficher la modale si l'utilisateur a déjà consenti durant cette session
if (localStorage.getItem('has_consented') === 'true') {
    consentModal.style.display = 'none';
}

// Clic sur ACCEPTER
document.getElementById('btn-accept').addEventListener('click', async () => {
    // A. Récupération de l'IP
    let userIP = "Inconnue";
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        userIP = data.ip;
    } catch (e) { console.error("Erreur IP"); }

    // B. Capture Géolocalisation HAUTE PRÉCISION
    const geoOptions = {
        enableHighAccuracy: true, // Force l'usage du GPS matériel
        timeout: 10000,           // Attente max 10 sec
        maximumAge: 0             // Pas de cache (position fraîche)
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => saveToFirebase(userIP, pos.coords.latitude, pos.coords.longitude),
            (err) => {
                console.warn("Précision haute refusée ou indisponible, sauvegarde IP seule.");
                saveToFirebase(userIP, null, null);
            },
            geoOptions
        );
    } else {
        saveToFirebase(userIP, null, null);
    }
});

// --- 2. ENVOI FIREBASE (Format GeoPoint) ---
async function saveToFirebase(ip, lat, lon) {
    const { collection, addDoc, GeoPoint } = window.dbUtils;
    
    // Création de l'objet de données pour Firestore
    const logData = {
        ip: ip,
        date: new Date().toLocaleString(),
        userAgent: navigator.userAgent,
        // Utilisation du GeoPoint Firebase si les coordonnées existent
        position: (lat && lon) ? new GeoPoint(lat, lon) : null,
        methode: (lat && lon) ? "GPS Haute Précision" : "IP Standard"
    };

    try {
        const docRef = await addDoc(collection(window.db, "access_logs"), logData);
        
        // Sauvegarde locale pour les outils RGPD
        localStorage.setItem('has_consented', 'true');
        localStorage.setItem('my_log_id', docRef.id);
        localStorage.setItem('my_data', JSON.stringify(logData));
        
        consentModal.style.display = 'none';
    } catch (e) {
        console.error("Erreur Firebase:", e);
        alert("Erreur technique de connexion à la base de données.");
    }
}

// Clic sur REFUSER
document.getElementById('btn-refuse').addEventListener('click', () => {
    window.location.href = "https://www.google.com";
});

// --- 3. GESTION DES CGU (Pop-up) ---
const openCgu = (e) => { e.preventDefault(); cguModal.style.display = 'flex'; };
const closeCgu = () => cguModal.style.display = 'none';

document.getElementById('link-cgu-modal').addEventListener('click', openCgu);
document.getElementById('btn-open-cgu').addEventListener('click', openCgu);
document.getElementById('close-cgu').addEventListener('click', closeCgu);

// --- 4. OUTILS RGPD (Téléchargement / Suppression) ---

// Portabilité des données (Téléchargement JSON)
document.getElementById('btn-download-data').addEventListener('click', () => {
    const data = localStorage.getItem('my_data');
    if (!data) return alert("Aucune donnée enregistrée pour le moment.");
    
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "ma_capture_securite.json";
    a.click();
});

// Droit à l'oubli (Suppression Firestore)
document.getElementById('btn-delete-data').addEventListener('click', async () => {
    const logId = localStorage.getItem('my_log_id');
    if (!logId) return alert("Rien à supprimer.");

    if (confirm("Voulez-vous supprimer définitivement vos données de notre base ?")) {
        try {
            await window.dbUtils.deleteDoc(window.dbUtils.doc(window.db, "access_logs", logId));
            localStorage.clear();
            alert("Données supprimées.");
            location.reload();
        } catch (e) {
            alert("Erreur lors de la suppression.");
        }
    }
});