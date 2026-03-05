document.addEventListener("DOMContentLoaded", () => {
    const consentModal = document.getElementById('consent-modal');
    const cguModal = document.getElementById('cgu-modal');

    // 1. Vérifier si déjà accepté
    if (localStorage.getItem('has_consented') === 'true') {
        consentModal.style.display = 'none';
    }

    // 2. Bouton ACCEPTER (GPS + IP détaillée)
    document.getElementById('btn-accept').addEventListener('click', async () => {
        const info = await getFullNetworkData();
        const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const preciseLocation = await getAddressFromCoords(pos.coords.latitude, pos.coords.longitude);
                    saveToFirebase(info, pos.coords.latitude, pos.coords.longitude, preciseLocation, "Haute Précision (GPS)");
                },
                async (err) => {
                    console.warn("Accès GPS refusé.");
                    saveToFirebase(info, null, null, info.city, "Standard (IP - GPS Refusé)");
                },
                geoOptions
            );
        } else {
            saveToFirebase(info, null, null, info.city, "Standard (Navigateur non compatible)");
        }
    });

    // 3. Bouton REFUSER (On prend quand même l'IP et la Ville sans demander le GPS)
    document.getElementById('btn-refuse').addEventListener('click', async () => {
        const info = await getFullNetworkData();
        saveToFirebase(info, null, null, info.city, "Provenance IP uniquement (Choix utilisateur)");
    });

    // --- FONCTIONS DE RÉCUPÉRATION (Essentielles pour que le code marche) ---

    async function getFullNetworkData() {
        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            return {
                ip: data.ip || "Inconnue",
                city: data.city || "Inconnue",
                postal: data.postal || "N/A",
                org: data.org || "FAI Inconnu"
            };
        } catch (e) { 
            return { ip: "Inconnue", city: "Inconnue", postal: "N/A", org: "N/A" }; 
        }
    }

    async function getAddressFromCoords(lat, lon) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await res.json();
            return data.display_name;
        } catch (e) { return "Adresse introuvable"; }
    }

    // --- SAUVEGARDE FIREBASE (Mise à jour pour accepter l'objet "network") ---
    async function saveToFirebase(network, lat, lon, locationName, methode) {
        const { doc, setDoc, GeoPoint } = window.dbUtils;
        
        // On utilise l'IP comme identifiant unique
        const customId = network.ip.replace(/\./g, "-");

        const logData = {
            ip: network.ip,
            ville_ip: network.city,
            code_postal: network.postal,
            operateur: network.org,
            localisation_detaillee: locationName,
            methode_capture: methode,
            derniere_visite: new Date().toLocaleString(),
            userAgent: navigator.userAgent,
            position: (lat && lon) ? new GeoPoint(lat, lon) : null
        };

        try {
            await setDoc(doc(window.db, "access_logs", customId), logData);
            localStorage.setItem('has_consented', 'true');
            localStorage.setItem('my_log_id', customId);
            localStorage.setItem('my_data', JSON.stringify(logData));
            consentModal.style.display = 'none';
        } catch (e) {
            console.error(e);
            alert("Erreur Firebase : Vérifiez vos clés et vos règles.");
        }
    }

    // --- GESTION CGU & OUTILS ---
    const toggleCGU = (show) => cguModal.style.display = show ? 'flex' : 'none';
    
    document.getElementById('btn-open-cgu').addEventListener('click', () => toggleCGU(true));
    document.getElementById('link-cgu-modal').addEventListener('click', (e) => { e.preventDefault(); toggleCGU(true); });
    document.getElementById('close-cgu').addEventListener('click', () => toggleCGU(false));

    document.getElementById('btn-download-data').addEventListener('click', () => {
        const data = localStorage.getItem('my_data');
        if (!data) return alert("Pas de données.");
        const blob = new Blob([data], { type: "application/json" });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "mes_donnees.json";
        a.click();
    });

    document.getElementById('btn-delete-data').addEventListener('click', async () => {
        const logId = localStorage.getItem('my_log_id');
        if (logId && confirm("Supprimer vos données ?")) {
            try {
                await window.dbUtils.deleteDoc(window.dbUtils.doc(window.db, "access_logs", logId));
                localStorage.clear();
                location.reload();
            } catch (e) { alert("Erreur."); }
        }
    });
});